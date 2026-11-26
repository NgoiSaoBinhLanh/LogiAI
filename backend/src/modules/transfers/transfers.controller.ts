import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import {
  approveTransferSchema,
  createTransferSchema,
  listTransfersQuerySchema,
  receiveTransferSchema,
  updateTransferGpsSchema,
} from './transfers.schema';
import { TransferDomainError, transfersService } from './transfers.service';

export class TransfersController {
  async listLive(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await transfersService.listLiveFleet();
      sendSuccess(res, { items });
    } catch (err: unknown) {
      next(err);
    }
  }

  async updateGps(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const input = updateTransferGpsSchema.parse(req.body);
      const log = await transfersService.updateGps(id, input);
      sendSuccess(res, { log }, 'Đã cập nhật vị trí GPS chuyến xe');
    } catch (err: unknown) {
      if (err instanceof TransferDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listTransfersQuerySchema.parse(req.query);
      const isAdmin = req.user!.roles.includes('ADMIN');
      const data = await transfersService.list(query, req.user!.branchId, isAdmin);
      sendSuccess(res, data);
    } catch (err: unknown) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createTransferSchema.parse(req.body);
      const result = await transfersService.create(input, req.user!.id, req.ip || null);
      sendSuccess(res, { transfer: result }, 'Đã tạo yêu cầu điều chuyển và giữ chỗ tồn nguồn', 201);
    } catch (err: unknown) {
      if (err instanceof TransferDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const input = approveTransferSchema.parse(req.body || {});
      const result = await transfersService.approve(id, input, req.user!.id, req.ip || null);
      sendSuccess(res, { transfer: result }, 'Đã ký duyệt lệnh điều chuyển');
    } catch (err: unknown) {
      if (err instanceof TransferDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await transfersService.reject(id, req.user!.id, req.ip || null);
      sendSuccess(res, { transfer: result }, 'Đã từ chối lệnh điều chuyển và giải phóng tồn giữ chỗ');
    } catch (err: unknown) {
      if (err instanceof TransferDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async dispatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const result = await transfersService.dispatch(id, req.user!.id, req.ip || null);
      sendSuccess(res, { transfer: result }, 'Đã xác nhận xuất bến Đang vận chuyển');
    } catch (err: unknown) {
      if (err instanceof TransferDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async receive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = BigInt(req.params.id);
      const input = receiveTransferSchema.parse(req.body);
      const result = await transfersService.receive(id, input, req.user!.id, req.ip || null);
      sendSuccess(res, { transfer: result }, 'Đã xác nhận tiếp nhận hàng điều chuyển');
    } catch (err: unknown) {
      if (err instanceof TransferDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }
}

export const transfersController = new TransfersController();
