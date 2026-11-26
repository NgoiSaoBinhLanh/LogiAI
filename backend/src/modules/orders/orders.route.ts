import { Router } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermissions,
} from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { ordersController } from './orders.controller';
import {
  allocateOrderSchema,
  createOrderSchema,
  listOrdersQuerySchema,
  updateOrderStageSchema,
} from './orders.schema';

const router = Router();

router.use(authenticate);

router.get(
  '/board',
  requireAnyPermission('ORDER_READ', 'ORDER_ALLOCATE', 'TICKET_CREATE'),
  (req, res, next) => ordersController.board(req, res, next)
);

router.patch(
  '/:id/stage',
  requireAnyPermission('ORDER_ALLOCATE', 'TICKET_CREATE'),
  validateRequest({ body: updateOrderStageSchema }),
  (req, res, next) => ordersController.updateStage(req, res, next)
);

router.get(
  '/',
  requireAnyPermission('ORDER_READ', 'ORDER_ALLOCATE'),
  validateRequest({ query: listOrdersQuerySchema }),
  (req, res, next) => ordersController.list(req, res, next)
);

router.post(
  '/',
  requirePermissions('ORDER_ALLOCATE'),
  validateRequest({ body: createOrderSchema }),
  (req, res, next) => ordersController.create(req, res, next)
);

router.get(
  '/:id/suggest-branch',
  requirePermissions('ORDER_ALLOCATE'),
  (req, res, next) => ordersController.suggestBranch(req, res, next)
);

router.post(
  '/:id/allocate',
  requirePermissions('ORDER_ALLOCATE'),
  validateRequest({ body: allocateOrderSchema }),
  (req, res, next) => ordersController.allocate(req, res, next)
);

export const ordersRouter = router;
