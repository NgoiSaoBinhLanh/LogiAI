import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import {
  createTicketSchema,
  listStocksQuerySchema,
  listTicketsQuerySchema,
} from './inventory.schema';
import { InventoryDomainError, inventoryService } from './inventory.service';

export class InventoryController {
  async listStocks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listStocksQuerySchema.parse(req.query);
      const isAdmin = req.user!.roles.includes('ADMIN');
      const data = await inventoryService.listStocks(query, req.user!.branchId, isAdmin);
      sendSuccess(res, data);
    } catch (err: unknown) {
      next(err);
    }
  }

  async suggestBins(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchIdParam = req.query.branchId as string | undefined;
      const targetBranchId = branchIdParam ? BigInt(branchIdParam) : req.user!.branchId;
      if (!targetBranchId) {
        sendError(res, 'MISSING_BRANCH', 'Vui lòng chọn chi nhánh', 400);
        return;
      }
      const bins = await inventoryService.suggestBins(targetBranchId);
      sendSuccess(res, { bins });
    } catch (err: unknown) {
      next(err);
    }
  }

  async pickingList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchIdParam = req.query.branchId as string | undefined;
      const productIdParam = req.query.productId as string | undefined;
      const targetBranchId = branchIdParam ? BigInt(branchIdParam) : req.user!.branchId;
      if (!targetBranchId) {
        sendError(res, 'MISSING_BRANCH', 'Vui lòng chọn chi nhánh', 400);
        return;
      }
      const list = await inventoryService.getFefoPickingList(
        targetBranchId,
        productIdParam ? BigInt(productIdParam) : undefined
      );
      sendSuccess(res, { items: list });
    } catch (err: unknown) {
      next(err);
    }
  }

  async listTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listTicketsQuerySchema.parse(req.query);
      const isAdmin = req.user!.roles.includes('ADMIN');
      const data = await inventoryService.listTickets(query, req.user!.branchId, isAdmin);
      sendSuccess(res, data);
    } catch (err: unknown) {
      next(err);
    }
  }

  async createTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createTicketSchema.parse(req.body);
      const isAdmin = req.user!.roles.includes('ADMIN');
      const ticket = await inventoryService.createTicket(
        input,
        req.user!.id,
        req.user!.branchId,
        isAdmin,
        req.ip || null
      );
      sendSuccess(res, { ticket }, 'Tạo phiếu kho thành công', 201);
    } catch (err: unknown) {
      if (err instanceof InventoryDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async confirmTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticketId = BigInt(req.params.id);
      const isAdmin = req.user!.roles.includes('ADMIN');
      const ticket = await inventoryService.confirmTicket(
        ticketId,
        req.user!.id,
        req.user!.branchId,
        isAdmin,
        req.ip || null
      );
      sendSuccess(res, { ticket }, 'Xác nhận phiếu kho và cập nhật tồn kho thành công');
    } catch (err: unknown) {
      if (err instanceof InventoryDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }
}

export const inventoryController = new InventoryController();
