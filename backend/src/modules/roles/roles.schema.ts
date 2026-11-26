import { z } from 'zod';

export const createRoleSchema = z.object({
  roleCode: z
    .string()
    .trim()
    .min(2, 'Mã vai trò tối thiểu 2 ký tự')
    .max(50)
    .regex(/^[A-Z0-9_]+$/, 'Mã vai trò chỉ gồm chữ HOA, số và dấu gạch dưới _'),
  roleName: z.string().trim().min(2, 'Tên vai trò tối thiểu 2 ký tự').max(100),
  description: z.string().trim().max(255).optional(),
});

export const cloneRoleSchema = z.object({
  roleCode: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_]+$/),
  roleName: z.string().trim().min(2).max(100),
  description: z.string().trim().max(255).optional(),
});

export const updateRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string().min(1)),
  otpVerified: z.boolean().optional().default(true),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type CloneRoleInput = z.infer<typeof cloneRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
