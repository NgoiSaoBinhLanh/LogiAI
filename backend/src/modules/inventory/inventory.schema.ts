import { TicketStatus, TicketType } from '@prisma/client';
import { z } from 'zod';

export const listStocksQuerySchema = z.object({
  search: z.string().optional(),
  branchId: z.string().optional(),
  categoryId: z.string().optional(),
  lowStockOnly: z.coerce.boolean().optional().default(false),
  expiringSoonDays: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listTicketsQuerySchema = z.object({
  type: z.nativeEnum(TicketType).optional(),
  branchId: z.string().optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTicketSchema = z.object({
  type: z.nativeEnum(TicketType),
  branchId: z.string().min(1),
  supplierName: z.string().trim().max(255).optional().nullable(),
  reason: z.string().trim().max(255).optional().nullable(),
  confirmImmediately: z.boolean().optional().default(false),
  details: z
    .array(
      z.object({
        productId: z.string().min(1),
        binId: z.string().min(1),
        batchNo: z.string().trim().min(1).max(100).default('DEFAULT'),
        expDate: z.string().optional().nullable(),
        qty: z.coerce.number().int().positive('Số lượng phải là số nguyên dương > 0'),
      })
    )
    .min(1, 'Phiếu kho phải có ít nhất 1 mặt hàng'),
});

export type ListStocksQuery = z.infer<typeof listStocksQuerySchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
