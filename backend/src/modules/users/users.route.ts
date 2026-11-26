import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { usersController } from './users.controller';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  updateUserStatusSchema,
} from './users.schema';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermissions('USER_READ'),
  validateRequest({ query: listUsersQuerySchema }),
  (req, res, next) => usersController.list(req, res, next)
);

router.post(
  '/',
  requirePermissions('USER_WRITE'),
  validateRequest({ body: createUserSchema }),
  (req, res, next) => usersController.create(req, res, next)
);

router.patch(
  '/:id',
  requirePermissions('USER_WRITE'),
  validateRequest({ body: updateUserSchema }),
  (req, res, next) => usersController.update(req, res, next)
);

router.patch(
  '/:id/status',
  requirePermissions('USER_WRITE'),
  validateRequest({ body: updateUserStatusSchema }),
  (req, res, next) => usersController.updateStatus(req, res, next)
);

export const usersRouter = router;
