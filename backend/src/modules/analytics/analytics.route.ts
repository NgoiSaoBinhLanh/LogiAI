import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAnyPermission } from '../../middlewares/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { analyticsService, PeriodFilter } from './analytics.service';

const kpisQuerySchema = z.object({
  period: z.enum(['week', 'month', 'quarter']).default('month'),
  branchId: z.string().optional(),
});

const router = Router();

router.use(authenticate);

router.get(
  '/kpis',
  requireAnyPermission('STOCK_READ', 'ORDER_READ', 'BRANCH_READ', 'ALERT_MANAGE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = kpisQuerySchema.parse(req.query);
      const data = await analyticsService.getKpis(q.period as PeriodFilter, q.branchId);
      sendSuccess(res, data);
    } catch (err: unknown) {
      next(err);
    }
  }
);

export const analyticsRouter = router;
