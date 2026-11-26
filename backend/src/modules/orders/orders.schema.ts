import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const listOrdersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  branchId: z.string().optional(),
  channel: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createOrderSchema = z.object({
  channel: z.string().trim().max(50).default('WEBSITE'),
  customerName: z.string().trim().min(2).max(150),
  customerAddress: z.string().trim().min(5).max(500),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.coerce.number().int().positive(),
        price: z.coerce.number().min(0),
      })
    )
    .min(1),
});

export const allocateOrderSchema = z.object({
  branchId: z.string().min(1),
});

export const updateOrderStageSchema = z.object({
  status: z.enum(['ALLOCATED', 'PACKING', 'SHIPPED', 'DELIVERED']),
  trackingNumber: z.string().trim().max(100).optional().nullable(),
  carrierName: z.string().trim().max(100).optional().nullable(),
  pickingProgress: z.coerce.number().int().min(0).max(100).optional(),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AllocateOrderInput = z.infer<typeof allocateOrderSchema>;
export type UpdateOrderStageInput = z.infer<typeof updateOrderStageSchema>;
