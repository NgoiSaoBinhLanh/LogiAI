import { Router } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermissions,
} from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { inventoryController } from './inventory.controller';
import {
  createTicketSchema,
  listStocksQuerySchema,
  listTicketsQuerySchema,
} from './inventory.schema';

const router = Router();

router.use(authenticate);

router.get(
  '/stocks',
  requireAnyPermission('STOCK_READ', 'TICKET_CREATE', 'ORDER_ALLOCATE'),
  validateRequest({ query: listStocksQuerySchema }),
  (req, res, next) => inventoryController.listStocks(req, res, next)
);

router.get(
  '/suggest-bin',
  requireAnyPermission('TICKET_CREATE', 'STOCK_READ'),
  (req, res, next) => inventoryController.suggestBins(req, res, next)
);

router.get(
  '/picking-list',
  requireAnyPermission('TICKET_CREATE', 'STOCK_READ'),
  (req, res, next) => inventoryController.pickingList(req, res, next)
);

router.get(
  '/tickets',
  requireAnyPermission('STOCK_READ', 'TICKET_CREATE', 'TICKET_APPROVE'),
  validateRequest({ query: listTicketsQuerySchema }),
  (req, res, next) => inventoryController.listTickets(req, res, next)
);

router.post(
  '/tickets',
  requirePermissions('TICKET_CREATE'),
  validateRequest({ body: createTicketSchema }),
  (req, res, next) => inventoryController.createTicket(req, res, next)
);

router.post(
  '/tickets/:id/confirm',
  requirePermissions('TICKET_CREATE'),
  (req, res, next) => inventoryController.confirmTicket(req, res, next)
);

export const inventoryRouter = router;
