import { Router } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermissions,
} from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { stockChecksController } from './stock-checks.controller';
import {
  createStockCheckSchema,
  listStockChecksQuerySchema,
  rejectStockCheckSchema,
  updateStockCheckCountSchema,
} from './stock-checks.schema';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission('STOCK_READ', 'TICKET_CREATE', 'TICKET_APPROVE'),
  validateRequest({ query: listStockChecksQuerySchema }),
  (req, res, next) => stockChecksController.list(req, res, next)
);

router.post(
  '/',
  requirePermissions('TICKET_CREATE'),
  validateRequest({ body: createStockCheckSchema }),
  (req, res, next) => stockChecksController.create(req, res, next)
);

router.patch(
  '/:id/count',
  requirePermissions('TICKET_CREATE'),
  validateRequest({ body: updateStockCheckCountSchema }),
  (req, res, next) => stockChecksController.updateCounts(req, res, next)
);

router.post(
  '/:id/submit',
  requirePermissions('TICKET_CREATE'),
  (req, res, next) => stockChecksController.submit(req, res, next)
);

router.post(
  '/:id/approve',
  requirePermissions('TICKET_APPROVE'),
  (req, res, next) => stockChecksController.approve(req, res, next)
);

router.post(
  '/:id/reject',
  requirePermissions('TICKET_APPROVE'),
  validateRequest({ body: rejectStockCheckSchema }),
  (req, res, next) => stockChecksController.reject(req, res, next)
);

export const stockChecksRouter = router;
