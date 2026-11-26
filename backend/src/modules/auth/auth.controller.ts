import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { loadLiveRbacProfile } from '../../middlewares/auth.middleware';
import { sendError, sendSuccess } from '../../utils/response';
import { forgotPasswordSchema, loginSchema } from './auth.schema';
import { AuthError, authService } from './auth.service';

const REFRESH_COOKIE_NAME = 'logai_refresh_token';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  return req.ip || 'unknown';
}

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.HTTPS_ENABLED,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/api/auth',
  });
}

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const ip = getClientIp(req);
      const userAgent = req.headers['user-agent'] || null;

      const result = await authService.login(input, ip, userAgent);
      setRefreshCookie(res, result.refreshToken, result.expiresAt);

      sendSuccess(
        res,
        {
          accessToken: result.accessToken,
          user: result.user,
        },
        'Đăng nhập thành công'
      );
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        sendError(res, err.code, err.message, err.status, err.details);
        return;
      }
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
      const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
      const rawToken = cookieToken || bodyToken;

      if (!rawToken) {
        sendError(res, 'MISSING_REFRESH_TOKEN', 'Không tìm thấy phiên đăng nhập', 401);
        return;
      }

      const ip = getClientIp(req);
      const userAgent = req.headers['user-agent'] || null;
      const result = await authService.refresh(rawToken, ip, userAgent);

      setRefreshCookie(res, result.refreshToken, result.expiresAt);
      sendSuccess(res, {
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
      const ip = getClientIp(req);
      await authService.logout(cookieToken, req.user?.id, ip);
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
      sendSuccess(res, null, 'Đăng xuất thành công');
    } catch (err: unknown) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'UNAUTHORIZED', 'Chưa xác thực', 401);
        return;
      }
      const liveProfile = await loadLiveRbacProfile(req.user.id);
      if (!liveProfile) {
        sendError(res, 'NOT_FOUND', 'Không tìm thấy người dùng', 404);
        return;
      }
      sendSuccess(res, { user: liveProfile });
    } catch (err: unknown) {
      next(err);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      // Trả thông báo chuẩn bảo mật không tiết lộ email có tồn tại hay không
      sendSuccess(
        res,
        { email },
        'Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục mật khẩu đã được gửi.'
      );
    } catch (err: unknown) {
      next(err);
    }
  }
}

export const authController = new AuthController();
