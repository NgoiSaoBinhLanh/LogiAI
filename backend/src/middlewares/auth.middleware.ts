import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  CachedRbacProfile,
  getCachedRbacProfile,
  setCachedRbacProfile,
} from '../config/redis';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/response';

export interface AuthenticatedUser {
  id: bigint;
  username: string;
  email: string;
  fullName: string;
  branchId: bigint | null;
  branchName: string | null;
  roleId: bigint;
  roleCode: string;
  roles: string[];
  permissions: string[];
  permissionVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const USER_RBAC_INCLUDE = {
  branch: { select: { id: true, name: true } },
  role: {
    include: {
      rolePermissions: {
        include: { permission: { select: { code: true } } },
      },
    },
  },
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: { select: { code: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithRbac = Prisma.UserGetPayload<{ include: typeof USER_RBAC_INCLUDE }>;

export function buildRbacProfile(user: UserWithRbac): CachedRbacProfile {
  const roleCodes = new Set<string>([user.role.roleCode]);
  const permissionCodes = new Set<string>();

  for (const rp of user.role.rolePermissions) {
    permissionCodes.add(rp.permission.code);
  }
  for (const ur of user.userRoles) {
    roleCodes.add(ur.role.roleCode);
    for (const rp of ur.role.rolePermissions) {
      permissionCodes.add(rp.permission.code);
    }
  }

  return {
    userId: user.id.toString(),
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    branchId: user.branchId ? user.branchId.toString() : null,
    branchName: user.branch ? user.branch.name : null,
    roleId: user.roleId.toString(),
    roleCode: user.role.roleCode,
    roles: Array.from(roleCodes),
    permissions: Array.from(permissionCodes),
    permissionVersion: user.permissionVersion,
    status: user.status,
  };
}

export async function loadLiveRbacProfile(userId: bigint): Promise<CachedRbacProfile | null> {
  const cached = await getCachedRbacProfile(userId);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: USER_RBAC_INCLUDE,
  });

  if (!user) return null;

  const profile = buildRbacProfile(user);
  await setCachedRbacProfile(profile);
  return profile;
}

/**
 * Middleware xác thực JWT và nạp quyền RBAC động mới nhất từ Redis / PostgreSQL.
 * Không phụ thuộc danh sách quyền tĩnh trong JWT payload -> quyền đổi có hiệu lực ngay ở request tiếp theo.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'UNAUTHORIZED', 'Yêu cầu đăng nhập để truy cập tài nguyên này', 401);
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    sendError(res, 'UNAUTHORIZED', 'Token xác thực không hợp lệ', 401);
    return;
  }

  try {
    const decoded = verifyAccessToken(token);
    const userId = BigInt(decoded.sub);
    const liveProfile = await loadLiveRbacProfile(userId);

    if (!liveProfile) {
      sendError(res, 'UNAUTHORIZED', 'Tài khoản không tồn tại', 401);
      return;
    }

    if (liveProfile.status !== 'ACTIVE') {
      sendError(res, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa hoặc ngừng hoạt động', 403);
      return;
    }

    req.user = {
      id: BigInt(liveProfile.userId),
      username: liveProfile.username,
      email: liveProfile.email,
      fullName: liveProfile.fullName,
      branchId: liveProfile.branchId ? BigInt(liveProfile.branchId) : null,
      branchName: liveProfile.branchName,
      roleId: BigInt(liveProfile.roleId),
      roleCode: liveProfile.roleCode,
      roles: liveProfile.roles,
      permissions: liveProfile.permissions,
      permissionVersion: liveProfile.permissionVersion,
    };

    next();
  } catch {
    sendError(res, 'INVALID_TOKEN', 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ', 401);
  }
}

/**
 * Middleware kiểm tra quyền động (yêu cầu người dùng có đủ tất cả quyền được liệt kê, hoặc là Super ADMIN).
 */
export function requirePermissions(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Yêu cầu đăng nhập', 401);
      return;
    }

    if (req.user.roles.includes('ADMIN')) {
      next();
      return;
    }

    const hasAll = requiredPermissions.every((perm) => req.user?.permissions.includes(perm));
    if (!hasAll) {
      sendError(
        res,
        'FORBIDDEN',
        `Bạn không có quyền thực hiện thao tác này (Cần: ${requiredPermissions.join(', ')})`,
        403
      );
      return;
    }

    next();
  };
}

export function requireAnyPermission(...acceptedPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Yêu cầu đăng nhập', 401);
      return;
    }

    if (req.user.roles.includes('ADMIN')) {
      next();
      return;
    }

    const hasAny = acceptedPermissions.some((perm) => req.user?.permissions.includes(perm));
    if (!hasAny) {
      sendError(
        res,
        'FORBIDDEN',
        `Bạn không có quyền truy cập tài nguyên này`,
        403
      );
      return;
    }

    next();
  };
}

export function authorizeRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Yêu cầu đăng nhập để truy cập tài nguyên này', 401);
      return;
    }

    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      sendError(res, 'FORBIDDEN', 'Bạn không có quyền truy cập vào tài nguyên này', 403);
      return;
    }

    next();
  };
}
