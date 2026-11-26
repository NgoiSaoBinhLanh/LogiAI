import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { healthRouter } from './modules/health/health.route';
import { authRouter } from './modules/auth/auth.route';
import { usersRouter } from './modules/users/users.route';
import { rbacRouter } from './modules/roles/roles.route';
import { branchesRouter } from './modules/branches/branches.route';
import { auditLogsRouter } from './modules/audit-logs/audit-logs.route';
import { productsRouter } from './modules/products/products.route';
import { inventoryRouter } from './modules/inventory/inventory.route';
import { stockChecksRouter } from './modules/stock-checks/stock-checks.route';
import { transfersRouter } from './modules/transfers/transfers.route';
import { ordersRouter } from './modules/orders/orders.route';
import { alertsRouter } from './modules/alerts/alerts.route';
import { analyticsRouter } from './modules/analytics/analytics.route';
import { aiRouter } from './modules/ai/ai.route';
import { errorHandler } from './middlewares/error.middleware';
import { sendError } from './utils/response';

export function createApp(): Express {
  const app = express();

  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value
  );

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api', rbacRouter);
  app.use('/api/branches', branchesRouter);
  app.use('/api/audit-logs', auditLogsRouter);
  app.use('/api', productsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/stock-checks', stockChecksRouter);
  app.use('/api/transfers', transfersRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/ai', aiRouter);

  app.use((_req: Request, res: Response) => {
    sendError(res, 'NOT_FOUND', 'Đường dẫn API không tồn tại', 404);
  });

  app.use(errorHandler);

  return app;
}
