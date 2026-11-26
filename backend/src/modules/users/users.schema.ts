import { EntityStatus } from '@prisma/client';
import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  branchId: z.string().optional(),
  roleId: z.string().optional(),
  status: z.nativeEnum(EntityStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Tên đăng nhập tối thiểu 3 ký tự')
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Tên đăng nhập chỉ gồm chữ cái, số và ., _, -'),
  email: z.string().trim().email('Email không hợp lệ').max(255),
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(150),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{8,20}$/, 'Số điện thoại không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional(),
  branchId: z.string().nullable().optional(),
  roleId: z.string().min(1, 'Vui lòng chọn vai trò'),
  sendEmail: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(150).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{8,20}$/)
    .optional(),
  email: z.string().trim().email().max(255).optional(),
  branchId: z.string().nullable().optional(),
  roleId: z.string().min(1).optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(EntityStatus),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
