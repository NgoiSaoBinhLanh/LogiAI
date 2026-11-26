import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { rolesController } from './roles.controller';
import {
  cloneRoleSchema,
  createRoleSchema,
  updateRolePermissionsSchema,
} from './roles.schema';

const router = Router();

router.get('/permissions', authenticate, requirePermissions('ROLE_MANAGE'), (req, res, next) =>
  rolesController.listPermissions(req, res, next)
);

router.get('/roles', authenticate, requirePermissions('ROLE_MANAGE'), (req, res, next) =>
  rolesController.listRoles(req, res, next)
);

router.post(
  '/roles',
  authenticate,
  requirePermissions('ROLE_MANAGE'),
  validateRequest({ body: createRoleSchema }),
  (req, res, next) => rolesController.createRole(req, res, next)
);

router.post(
  '/roles/:id/clone',
  authenticate,
  requirePermissions('ROLE_MANAGE'),
  validateRequest({ body: cloneRoleSchema }),
  (req, res, next) => rolesController.cloneRole(req, res, next)
);

router.put(
  '/roles/:id/permissions',
  authenticate,
  requirePermissions('ROLE_MANAGE'),
  validateRequest({ body: updateRolePermissionsSchema }),
  (req, res, next) => rolesController.updatePermissions(req, res, next)
);

router.post(
  '/roles/:id/reset-default',
  authenticate,
  requirePermissions('ROLE_MANAGE'),
  (req, res, next) => rolesController.resetDefault(req, res, next)
);

export const rbacRouter = router;
