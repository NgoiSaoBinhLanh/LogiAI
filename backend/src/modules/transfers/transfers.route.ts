import { Router } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermissions,
} from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { transfersController } from './transfers.controller';
import {
  approveTransferSchema,
  createTransferSchema,
  listTransfersQuerySchema,
  receiveTransferSchema,
  updateTransferGpsSchema,
} from './transfers.schema';

const router = Router();

router.use(authenticate);

router.get(
  '/live',
  requireAnyPermission('TRANSFER_TRACK', 'BRANCH_READ'),
  (req, res, next) => transfersController.listLive(req, res, next)
);

router.post(
  '/:id/gps',
  requireAnyPermission('TRANSFER_TRACK', 'TICKET_CREATE'),
  validateRequest({ body: updateTransferGpsSchema }),
  (req, res, next) => transfersController.updateGps(req, res, next)
);

router.get(
  '/',
  requireAnyPermission('TRANSFER_TRACK', 'TICKET_CREATE', 'TICKET_APPROVE'),
  validateRequest({ query: listTransfersQuerySchema }),
  (req, res, next) => transfersController.list(req, res, next)
);

router.post(
  '/',
  requireAnyPermission('TRANSFER_TRACK', 'TICKET_CREATE'),
  validateRequest({ body: createTransferSchema }),
  (req, res, next) => transfersController.create(req, res, next)
);

router.post(
  '/:id/approve',
  requirePermissions('TICKET_APPROVE'),
  validateRequest({ body: approveTransferSchema }),
  (req, res, next) => transfersController.approve(req, res, next)
);

router.post(
  '/:id/reject',
  requirePermissions('TICKET_APPROVE'),
  (req, res, next) => transfersController.reject(req, res, next)
);

router.post(
  '/:id/dispatch',
  requireAnyPermission('TICKET_CREATE', 'TRANSFER_TRACK'),
  (req, res, next) => transfersController.dispatch(req, res, next)
);

router.post(
  '/:id/receive',
  requirePermissions('TICKET_CREATE'),
  validateRequest({ body: receiveTransferSchema }),
  (req, res, next) => transfersController.receive(req, res, next)
);

export const transfersRouter = router;
