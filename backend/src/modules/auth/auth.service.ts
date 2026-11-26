import crypto from 'crypto';
import { AuditActionType, EntityStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import {
  invalidateUserRbacCache,
  setCachedRbacProfile,
} from '../../config/redis';
import {
  buildRbacProfile,
  USER_RBAC_INCLUDE,
} from '../../middlewares/auth.middleware';
import { recordAuditLog } from '../../utils/audit';
import { hashToken, verifyPasswordAsync } from '../../utils/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { LoginInput } from './auth.schema';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const REFRESH_TTL_DAYS = 7;

export class AuthError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class AuthService {
  async login(input: LoginInput, ipAddress: string | null, userAgent: string | null) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: input.identifier }, { email: input.identifier }],
      },
      include: USER_RBAC_INCLUDE,
    });

    if (!user) {
      throw new AuthError('INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không chính xác', 401);
    }

    if (user.status !== EntityStatus.ACTIVE) {
      throw new AuthError(
        'ACCOUNT_INACTIVE',
        'Tài khoản của bạn chưa được kích hoạt hoặc đã bị tạm khóa, vui lòng liên hệ Quản trị viên',
        403
      );
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const remainingMin = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000);
      throw new AuthError(
        'ACCOUNT_LOCKED',
        `Tài khoản đang bị tạm khóa do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau ${remainingMin} phút.`,
        423,
        { lockedUntil: user.lockedUntil.toISOString(), remainingMinutes: remainingMin }
      );
    }

    const isPasswordValid = await verifyPasswordAsync(input.password, user.password);
    if (!isPasswordValid) {
      const newAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = shouldLock ? new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : newAttempts,
          lockedUntil,
        },
      });

      if (shouldLock) {
        throw new AuthError(
          'ACCOUNT_LOCKED',
          `Bạn đã nhập sai mật khẩu quá ${MAX_FAILED_ATTEMPTS} lần liên tiếp. Tài khoản bị khóa ${LOCK_DURATION_MINUTES} phút.`,
          423,
          { lockedUntil: lockedUntil?.toISOString() }
        );
      }

      const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
      throw new AuthError(
        'INVALID_CREDENTIALS',
        `Tên đăng nhập hoặc mật khẩu không chính xác. Số lần thử còn lại: ${remaining}`,
        401,
        { remainingAttempts: remaining }
      );
    }

    const liveProfile = buildRbacProfile(user);

    const accessToken = signAccessToken({
      sub: liveProfile.userId,
      username: liveProfile.username,
      roleCode: liveProfile.roleCode,
      permissionVersion: liveProfile.permissionVersion,
    });

    const jti = crypto.randomUUID();
    const rawRefreshToken = signRefreshToken({
      sub: liveProfile.userId,
      jti,
    });

    const expiresAt = new Date(
      now.getTime() + (input.rememberMe ? REFRESH_TTL_DAYS * 2 : REFRESH_TTL_DAYS) * 24 * 60 * 60 * 1000
    );

    const tasks: Array<Promise<unknown>> = [
      setCachedRbacProfile(liveProfile),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawRefreshToken),
          expiresAt,
          ipAddress,
          userAgent,
        },
      }),
    ];

    if (user.failedLoginAttempts > 0 || user.lockedUntil !== null) {
      tasks.push(
        prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        })
      );
    }

    await Promise.all(tasks);

    // Ghi audit log bất đồng bộ để không làm chậm phản hồi đăng nhập
    void recordAuditLog({
      userId: user.id,
      actionType: AuditActionType.LOGIN,
      module: 'AUTH',
      newData: { username: user.username, roleCode: liveProfile.roleCode },
      ipAddress,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresAt,
      user: liveProfile,
    };
  }

  async refresh(rawRefreshToken: string, ipAddress: string | null, userAgent: string | null) {
    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token không hợp lệ hoặc đã hết hạn', 401);
    }

    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: USER_RBAC_INCLUDE } },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt <= new Date()) {
      // Nếu token đã bị thu hồi mà vẫn dùng lại -> thu hồi toàn bộ token của user (chống replay attack)
      if (storedToken?.isRevoked) {
        await prisma.refreshToken.updateMany({
          where: { userId: storedToken.userId, isRevoked: false },
          data: { isRevoked: true, revokedAt: new Date() },
        });
      }
      throw new AuthError('REFRESH_REVOKED', 'Phiên làm việc đã hết hạn hoặc bị thu hồi', 401);
    }

    if (storedToken.user.status !== EntityStatus.ACTIVE) {
      throw new AuthError('ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa', 403);
    }

    const userId = BigInt(decoded.sub);
    const liveProfile = buildRbacProfile(storedToken.user);

    // Xoay vòng (Rotate) Refresh Token cũ -> mới
    const newJti = crypto.randomUUID();
    const newRawRefreshToken = signRefreshToken({
      sub: liveProfile.userId,
      jti: newJti,
    });
    const newExpiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await Promise.all([
      setCachedRbacProfile(liveProfile),
      prisma.$transaction([
        prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { isRevoked: true, revokedAt: new Date() },
        }),
        prisma.refreshToken.create({
          data: {
            userId,
            tokenHash: hashToken(newRawRefreshToken),
            expiresAt: newExpiresAt,
            ipAddress,
            userAgent,
          },
        }),
      ]),
    ]);

    const newAccessToken = signAccessToken({
      sub: liveProfile.userId,
      username: liveProfile.username,
      roleCode: liveProfile.roleCode,
      permissionVersion: liveProfile.permissionVersion,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
      expiresAt: newExpiresAt,
      user: liveProfile,
    };
  }

  async logout(rawRefreshToken: string | undefined, userId?: bigint, ipAddress?: string | null) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    }

    if (userId) {
      await invalidateUserRbacCache(userId);
      await recordAuditLog({
        userId,
        actionType: AuditActionType.LOGOUT,
        module: 'AUTH',
        ipAddress: ipAddress ?? null,
      });
    }
  }
}

export const authService = new AuthService();
