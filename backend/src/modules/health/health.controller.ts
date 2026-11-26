import { Request, Response, NextFunction } from 'express';
import { healthService } from './health.service';
import { sendSuccess, sendError } from '../../utils/response';

export class HealthController {
  async getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const healthData = await healthService.getHealthStatus();
      // Trả về HTTP 200 kèm data chi tiết để Frontend/Monitor luôn đọc được trạng thái từng service
      sendSuccess(res, healthData, 'Health check completed successfully', 200);
    } catch (err: unknown) {
      if (err instanceof Error) {
        sendError(res, 'HEALTH_CHECK_FAILED', err.message, 500);
      } else {
        next(err);
      }
    }
  }
}

export const healthController = new HealthController();
