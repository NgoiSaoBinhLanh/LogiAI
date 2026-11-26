import { AlertSeverity, AlertType } from '@prisma/client';
import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAnyPermission } from '../../middlewares/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { alertsService } from './alerts.service';

const listAlertsQuerySchema = z.object({
  isResolved: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  severity: z.nativeEnum(AlertSeverity).optional(),
  alertType: z.nativeEnum(AlertType).optional(),
  branchId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission('ALERT_MANAGE', 'STOCK_READ', 'ORDER_READ', 'TRANSFER_TRACK'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = listAlertsQuerySchema.parse(req.query);
      const isAdmin = req.user!.roles.includes('ADMIN');
      const data = await alertsService.list(q, req.user!.branchId, isAdmin);
      sendSuccess(res, data);
    } catch (err: unknown) {
      next(err);
    }
  }
);

router.patch(
  '/:id/resolve',
  requireAnyPermission('ALERT_MANAGE', 'TICKET_APPROVE', 'ORDER_ALLOCATE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const alert = await alertsService.resolve(id, req.user!.id);
      sendSuccess(res, { alert }, 'Đã đánh dấu xử lý cảnh báo');
    } catch (err: unknown) {
      next(err);
    }
  }
);

router.post(
  '/scan',
  requireAnyPermission('ALERT_MANAGE', 'ROLE_MANAGE'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await alertsService.triggerScan();
      sendSuccess(res, { summary }, 'Đã hoàn tất quét cảnh báo PB19, PB12, PB14');
    } catch (err: unknown) {
      next(err);
    }
  }
);

export const alertsRouter = router;
