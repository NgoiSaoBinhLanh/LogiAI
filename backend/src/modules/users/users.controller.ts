import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  updateUserStatusSchema,
} from './users.schema';
import { UserDomainError, usersService } from './users.service';

export class UsersController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listUsersQuerySchema.parse(req.query);
      const data = await usersService.listUsers(query);
      sendSuccess(res, data);
    } catch (err: unknown) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createUserSchema.parse(req.body);
      const result = await usersService.createUser(input, req.user!.id, req.ip || null);
      sendSuccess(res, result, 'Tạo tài khoản nhân viên thành công', 201);
    } catch (err: unknown) {
      if (err instanceof UserDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetId = BigInt(req.params.id);
      const input = updateUserSchema.parse(req.body);
      const result = await usersService.updateUser(targetId, input, req.user!.id, req.ip || null);
      sendSuccess(res, { user: result }, 'Cập nhật tài khoản thành công');
    } catch (err: unknown) {
      if (err instanceof UserDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetId = BigInt(req.params.id);
      const input = updateUserStatusSchema.parse(req.body);
      const result = await usersService.updateUserStatus(
        targetId,
        input,
        req.user!.id,
        req.ip || null
      );
      sendSuccess(res, { user: result }, 'Cập nhật trạng thái tài khoản thành công');
    } catch (err: unknown) {
      if (err instanceof UserDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }
}

export const usersController = new UsersController();
