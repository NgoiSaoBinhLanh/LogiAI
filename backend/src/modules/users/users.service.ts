import { AuditActionType, EntityStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { invalidateUserRbacCache } from '../../config/redis';
import { emitRbacUpdate } from '../../sockets/socket.server';
import { recordAuditLog } from '../../utils/audit';
import { generateRandomPassword, hashPassword } from '../../utils/crypto';
import {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UpdateUserStatusInput,
} from './users.schema';

export class UserDomainError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class UsersService {
  async listUsers(query: ListUsersQuery) {
    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { username: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.branchId) {
      where.branchId = BigInt(query.branchId);
    }
    if (query.roleId) {
      where.roleId = BigInt(query.roleId);
    }
    if (query.status) {
      where.status = query.status;
    }

    const skip = (query.page - 1) * query.limit;

    const [total, items] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          phone: true,
          branchId: true,
          roleId: true,
          status: true,
          permissionVersion: true,
          createdAt: true,
          updatedAt: true,
          branch: { select: { id: true, code: true, name: true } },
          role: { select: { id: true, roleCode: true, roleName: true } },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async createUser(input: CreateUserInput, actorId: bigint, ipAddress: string | null) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: input.username }, { email: input.email }],
      },
    });

    if (existing) {
      throw new UserDomainError(
        'DUPLICATE_USER',
        'Email hoặc Tên đăng nhập đã được sử dụng',
        409
      );
    }

    const roleId = BigInt(input.roleId);
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new UserDomainError('ROLE_NOT_FOUND', 'Vai trò không tồn tại', 404);
    }

    const branchId = input.branchId ? BigInt(input.branchId) : null;
    if (branchId !== null) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        throw new UserDomainError('BRANCH_NOT_FOUND', 'Chi nhánh không tồn tại', 404);
      }
    }

    const tempPassword = input.password || generateRandomPassword(10);
    const passwordHash = hashPassword(tempPassword);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          password: passwordHash,
          fullName: input.fullName,
          phone: input.phone,
          branchId,
          roleId,
          status: EntityStatus.ACTIVE,
        },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          phone: true,
          branchId: true,
          roleId: true,
          status: true,
          createdAt: true,
          branch: { select: { id: true, code: true, name: true } },
          role: { select: { id: true, roleCode: true, roleName: true } },
        },
      });

      await tx.userRole.create({
        data: { userId: user.id, roleId },
      });

      return user;
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'USER',
      newData: {
        id: created.id.toString(),
        username: created.username,
        email: created.email,
        roleCode: created.role.roleCode,
        branchId: created.branchId?.toString() ?? null,
      },
      ipAddress,
    });

    return {
      user: created,
      temporaryPassword: input.password ? undefined : tempPassword,
    };
  }

  async updateUser(
    targetUserId: bigint,
    input: UpdateUserInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const existing = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { role: true },
    });

    if (!existing) {
      throw new UserDomainError('USER_NOT_FOUND', 'Không tìm thấy tài khoản', 404);
    }

    if (input.email && input.email !== existing.email) {
      const dup = await prisma.user.findFirst({
        where: { email: input.email, NOT: { id: targetUserId } },
      });
      if (dup) {
        throw new UserDomainError('DUPLICATE_EMAIL', 'Email đã tồn tại trong hệ thống', 409);
      }
    }

    const nextRoleId = input.roleId ? BigInt(input.roleId) : existing.roleId;
    const nextBranchId =
      input.branchId === undefined
        ? existing.branchId
        : input.branchId === null
        ? null
        : BigInt(input.branchId);

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetUserId },
        data: {
          fullName: input.fullName ?? existing.fullName,
          phone: input.phone ?? existing.phone,
          email: input.email ?? existing.email,
          branchId: nextBranchId,
          roleId: nextRoleId,
          permissionVersion: { increment: 1 },
        },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          phone: true,
          branchId: true,
          roleId: true,
          status: true,
          permissionVersion: true,
          branch: { select: { id: true, code: true, name: true } },
          role: { select: { id: true, roleCode: true, roleName: true } },
        },
      });

      if (input.roleId && nextRoleId !== existing.roleId) {
        await tx.userRole.deleteMany({ where: { userId: targetUserId } });
        await tx.userRole.create({
          data: { userId: targetUserId, roleId: nextRoleId },
        });
      }

      return user;
    });

    await invalidateUserRbacCache(targetUserId);
    emitRbacUpdate([targetUserId], updated.role.roleCode);

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'USER',
      oldData: {
        fullName: existing.fullName,
        roleId: existing.roleId.toString(),
        branchId: existing.branchId?.toString() ?? null,
      },
      newData: {
        fullName: updated.fullName,
        roleId: updated.roleId.toString(),
        branchId: updated.branchId?.toString() ?? null,
      },
      ipAddress,
    });

    return updated;
  }

  async updateUserStatus(
    targetUserId: bigint,
    input: UpdateUserStatusInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    if (targetUserId === actorId && input.status !== EntityStatus.ACTIVE) {
      throw new UserDomainError(
        'CANNOT_DISABLE_SELF',
        'Không được phép tự khóa tài khoản Quản trị viên đang đăng nhập',
        400
      );
    }

    const existing = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!existing) {
      throw new UserDomainError('USER_NOT_FOUND', 'Không tìm thấy tài khoản', 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetUserId },
        data: {
          status: input.status,
          permissionVersion: { increment: 1 },
        },
        select: {
          id: true,
          username: true,
          status: true,
          permissionVersion: true,
        },
      });

      // Nếu khóa/ngừng hoạt động -> thu hồi toàn bộ refresh token ngay lập tức (PB02)
      if (input.status !== EntityStatus.ACTIVE) {
        await tx.refreshToken.updateMany({
          where: { userId: targetUserId, isRevoked: false },
          data: { isRevoked: true, revokedAt: new Date() },
        });
      }

      return user;
    });

    await invalidateUserRbacCache(targetUserId);
    emitRbacUpdate([targetUserId]);

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'USER_STATUS',
      oldData: { status: existing.status },
      newData: { status: updated.status },
      ipAddress,
    });

    return updated;
  }
}

export const usersService = new UsersService();
