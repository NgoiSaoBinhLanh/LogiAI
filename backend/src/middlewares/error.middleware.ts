import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { sendError } from '../utils/response';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    sendError(res, 'VALIDATION_ERROR', 'Dữ liệu đầu vào không hợp lệ', 400, err.errors);
    return;
  }

  if (err instanceof SyntaxError && (err.message.includes('BigInt') || err.message.includes('JSON'))) {
    sendError(res, 'BAD_REQUEST', 'Tham số định danh hoặc JSON không hợp lệ', 400);
    return;
  }

  logger.error(`Unhandled Exception: ${err.message}`, { stack: err.stack });

  const statusCode = (err as { status?: number }).status || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Đã xảy ra lỗi nội bộ máy chủ'
      : err.message;

  sendError(res, 'INTERNAL_SERVER_ERROR', message, statusCode);
}
