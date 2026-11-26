import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import {
  createBinSchema,
  createBranchSchema,
  createZoneSchema,
  updateBranchSchema,
  updateBranchStatusSchema,
} from './branches.schema';
import { BranchDomainError, branchesService } from './branches.service';

export class BranchesController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branches = await branchesService.listBranches();
      sendSuccess(res, { branches });
    } catch (err: unknown) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createBranchSchema.parse(req.body);
      const branch = await branchesService.createBranch(input, req.user!.id, req.ip || null);
      sendSuccess(res, { branch }, 'Tạo chi nhánh mới thành công', 201);
    } catch (err: unknown) {
      if (err instanceof BranchDomainError) {
        sendError(res, err.code, err.message, err.status, err.details);
        return;
      }
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchId = BigInt(req.params.id);
      const input = updateBranchSchema.parse(req.body);
      const branch = await branchesService.updateBranch(
        branchId,
        input,
        req.user!.id,
        req.ip || null
      );
      sendSuccess(res, { branch }, 'Cập nhật chi nhánh thành công');
    } catch (err: unknown) {
      if (err instanceof BranchDomainError) {
        sendError(res, err.code, err.message, err.status, err.details);
        return;
      }
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchId = BigInt(req.params.id);
      const { status } = updateBranchStatusSchema.parse(req.body);
      const branch = await branchesService.updateBranchStatus(
        branchId,
        status,
        req.user!.id,
        req.ip || null
      );
      sendSuccess(res, { branch }, 'Cập nhật trạng thái chi nhánh thành công');
    } catch (err: unknown) {
      if (err instanceof BranchDomainError) {
        sendError(res, err.code, err.message, err.status, err.details);
        return;
      }
      next(err);
    }
  }

  async createZone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchId = BigInt(req.params.id);
      const input = createZoneSchema.parse(req.body);
      const zone = await branchesService.createZone(
        branchId,
        input,
        req.user!.id,
        req.ip || null
      );
      sendSuccess(res, { zone }, 'Thêm khu vực (Zone) thành công', 201);
    } catch (err: unknown) {
      if (err instanceof BranchDomainError) {
        sendError(res, err.code, err.message, err.status, err.details);
        return;
      }
      next(err);
    }
  }

  async createBin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zoneId = BigInt(req.params.zoneId);
      const input = createBinSchema.parse(req.body);
      const bin = await branchesService.createBin(zoneId, input, req.user!.id, req.ip || null);
      sendSuccess(res, { bin }, 'Thêm kệ (Bin) thành công', 201);
    } catch (err: unknown) {
      if (err instanceof BranchDomainError) {
        sendError(res, err.code, err.message, err.status, err.details);
        return;
      }
      next(err);
    }
  }
}

export const branchesController = new BranchesController();
