import { Router } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermissions,
} from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { branchesController } from './branches.controller';
import {
  createBinSchema,
  createBranchSchema,
  createZoneSchema,
  updateBranchSchema,
  updateBranchStatusSchema,
} from './branches.schema';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission(
    'BRANCH_READ',
    'BRANCH_WRITE',
    'USER_READ',
    'USER_WRITE',
    'ROLE_MANAGE',
    'STOCK_READ',
    'ORDER_ALLOCATE',
    'TRANSFER_TRACK'
  ),
  (req, res, next) => branchesController.list(req, res, next)
);

router.post(
  '/',
  requirePermissions('BRANCH_WRITE'),
  validateRequest({ body: createBranchSchema }),
  (req, res, next) => branchesController.create(req, res, next)
);

router.patch(
  '/:id',
  requirePermissions('BRANCH_WRITE'),
  validateRequest({ body: updateBranchSchema }),
  (req, res, next) => branchesController.update(req, res, next)
);

router.patch(
  '/:id/status',
  requirePermissions('BRANCH_WRITE'),
  validateRequest({ body: updateBranchStatusSchema }),
  (req, res, next) => branchesController.updateStatus(req, res, next)
);

router.post(
  '/:id/zones',
  requirePermissions('BRANCH_WRITE'),
  validateRequest({ body: createZoneSchema }),
  (req, res, next) => branchesController.createZone(req, res, next)
);

router.post(
  '/zones/:zoneId/bins',
  requirePermissions('BRANCH_WRITE'),
  validateRequest({ body: createBinSchema }),
  (req, res, next) => branchesController.createBin(req, res, next)
);

export const branchesRouter = router;
