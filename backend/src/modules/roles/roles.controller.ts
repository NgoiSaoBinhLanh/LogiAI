import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import {
  cloneRoleSchema,
  createRoleSchema,
  updateRolePermissionsSchema,
} from './roles.schema';
import { RoleDomainError, rolesService } from './roles.service';

export class RolesController {
  async listPermissions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const permissions = await rolesService.listPermissions();
      sendSuccess(res, { permissions });
    } catch (err: unknown) {
      next(err);
    }
  }

  async listRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await rolesService.listRoles();
      sendSuccess(res, { roles });
    } catch (err: unknown) {
      next(err);
    }
  }

  async createRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createRoleSchema.parse(req.body);
      const role = await rolesService.createRole(input, req.user!.id, req.ip || null);
      sendSuccess(res, { role }, 'Tạo vai trò mới thành công', 201);
    } catch (err: unknown) {
      if (err instanceof RoleDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async cloneRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sourceRoleId = BigInt(req.params.id);
      const input = cloneRoleSchema.parse(req.body);
      const role = await rolesService.cloneRole(sourceRoleId, input, req.user!.id, req.ip || null);
      sendSuccess(res, { role }, 'Sao chép cấu hình vai trò thành công', 201);
    } catch (err: unknown) {
      if (err instanceof RoleDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async updatePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roleId = BigInt(req.params.id);
      const input = updateRolePermissionsSchema.parse(req.body);
      const result = await rolesService.updateRolePermissions(
        roleId,
        input,
        req.user!.id,
        req.ip || null
      );
      sendSuccess(res, result, 'Cập nhật ma trận phân quyền thành công (có hiệu lực ngay)');
    } catch (err: unknown) {
      if (err instanceof RoleDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async resetDefault(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roleId = BigInt(req.params.id);
      const result = await rolesService.resetRoleDefault(roleId, req.user!.id, req.ip || null);
      sendSuccess(res, result, 'Đã khôi phục quyền mặc định của vai trò');
    } catch (err: unknown) {
      if (err instanceof RoleDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }
}

export const rolesController = new RolesController();
