import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import {
  createStockCheckSchema,
  listStockChecksQuerySchema,
  rejectStockCheckSchema,
  updateStockCheckCountSchema,
} from './stock-checks.schema';
import { StockCheckDomainError, stockChecksService } from './stock-checks.service';

export class StockChecksController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listStockChecksQuerySchema.parse(req.query);
      const isAdmin = req.user!.roles.includes('ADMIN');
      const data = await stockChecksService.list(query, req.user!.branchId, isAdmin);
      sendSuccess(res, data);
    } catch (err: unknown) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createStockCheckSchema.parse(req.body);
      const isAdmin = req.user!.roles.includes('ADMIN');
      const result = await stockChecksService.create(
        input,
        req.user!.id,
        req.user!.branchId,
        isAdmin,
        req.ip || null
      );
      sendSuccess(res, { stockCheck: result }, 'Đã khởi tạo đợt kiểm kê và khóa giao dịch tạm thời', 201);
    } catch (err: unknown) {
      if (err instanceof StockCheckDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async updateCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const input = updateStockCheckCountSchema.parse(req.body);
      const result = await stockChecksService.updateCounts(
        id,
        input,
        req.user!.id,
        req.ip || null
      );
      sendSuccess(res, { stockCheck: result }, 'Đã ghi nhận số lượng kiểm đếm thực tế');
    } catch (err: unknown) {
      if (err instanceof StockCheckDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await stockChecksService.submit(id, req.user!.id, req.ip || null);
      sendSuccess(res, { stockCheck: result }, 'Đã gửi phiếu kiểm kê lên Quản lý chi nhánh duyệt');
    } catch (err: unknown) {
      if (err instanceof StockCheckDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await stockChecksService.approve(id, req.user!.id, req.ip || null);
      sendSuccess(
        res,
        { stockCheck: result },
        'Đã phê duyệt phiếu kiểm kê, điều chỉnh tồn kho và mở khóa kệ'
      );
    } catch (err: unknown) {
      if (err instanceof StockCheckDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const input = rejectStockCheckSchema.parse(req.body);
      const result = await stockChecksService.reject(id, input, req.user!.id, req.ip || null);
      sendSuccess(res, { stockCheck: result }, 'Đã từ chối và yêu cầu kiểm đếm lại');
    } catch (err: unknown) {
      if (err instanceof StockCheckDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }
}

export const stockChecksController = new StockChecksController();
