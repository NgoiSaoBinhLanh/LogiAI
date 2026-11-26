import { StockCheckStatus } from '@prisma/client';
import { z } from 'zod';

export const listStockChecksQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.nativeEnum(StockCheckStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createStockCheckSchema = z.object({
  branchId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
});

export const updateStockCheckCountSchema = z.object({
  items: z
    .array(
      z.object({
        detailId: z.string().min(1),
        qtyActual: z.coerce.number().int().min(0),
        reason: z.string().trim().max(500).optional().nullable(),
      })
    )
    .min(1),
});

export const rejectStockCheckSchema = z.object({
  reason: z.string().trim().min(3, 'Vui lòng nhập lý do yêu cầu kiểm đếm lại').max(500),
});

export type ListStockChecksQuery = z.infer<typeof listStockChecksQuerySchema>;
export type CreateStockCheckInput = z.infer<typeof createStockCheckSchema>;
export type UpdateStockCheckCountInput = z.infer<typeof updateStockCheckCountSchema>;
export type RejectStockCheckInput = z.infer<typeof rejectStockCheckSchema>;
