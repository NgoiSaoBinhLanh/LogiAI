import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { authController } from './auth.controller';
import { forgotPasswordSchema, loginSchema } from './auth.schema';

const router = Router();

router.post('/login', validateRequest({ body: loginSchema }), (req, res, next) =>
  authController.login(req, res, next)
);

router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));

router.post('/logout', (req, res, next) => authController.logout(req, res, next));

router.get('/me', authenticate, (req, res, next) => authController.me(req, res, next));

router.post(
  '/forgot-password',
  validateRequest({ body: forgotPasswordSchema }),
  (req, res, next) => authController.forgotPassword(req, res, next)
);

export const authRouter = router;
