import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import {
  allocateOrderSchema,
  createOrderSchema,
  listOrdersQuerySchema,
  updateOrderStageSchema,
} from './orders.schema';
import { OrderDomainError, ordersService } from './orders.service';

export class OrdersController {
  async board(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchId = req.query.branchId as string | undefined;
      const isAdmin = req.user!.roles.includes('ADMIN');
      const items = await ordersService.getBoard(branchId, req.user!.branchId, isAdmin);
      sendSuccess(res, { items });
    } catch (err: unknown) {
      next(err);
    }
  }

  async updateStage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = BigInt(req.params.id);
      const input = updateOrderStageSchema.parse(req.body);
      const order = await ordersService.updateStage(orderId, input, req.user!.id, req.ip || null);
      sendSuccess(res, { order }, 'Đã cập nhật tiến độ đóng gói đơn hàng');
    } catch (err: unknown) {
      if (err instanceof OrderDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listOrdersQuerySchema.parse(req.query);
      const isAdmin = req.user!.roles.includes('ADMIN');
      const data = await ordersService.list(query, req.user!.branchId, isAdmin);
      sendSuccess(res, data);
    } catch (err: unknown) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createOrderSchema.parse(req.body);
      const order = await ordersService.create(input, req.user!.id, req.ip || null);
      sendSuccess(res, { order }, 'Tạo đơn hàng mới thành công', 201);
    } catch (err: unknown) {
      next(err);
    }
  }

  async suggestBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = BigInt(req.params.id);
      const suggestions = await ordersService.suggestBranches(orderId);
      sendSuccess(res, { suggestions });
    } catch (err: unknown) {
      if (err instanceof OrderDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async allocate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = BigInt(req.params.id);
      const input = allocateOrderSchema.parse(req.body);
      const order = await ordersService.allocate(orderId, input, req.user!.id, req.ip || null);
      sendSuccess(res, { order }, 'Phân bổ đơn hàng và giữ chỗ tồn kho thành công');
    } catch (err: unknown) {
      if (err instanceof OrderDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }
}

export const ordersController = new OrdersController();
