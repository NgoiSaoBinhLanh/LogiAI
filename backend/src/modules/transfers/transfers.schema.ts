import { TransferStatus } from '@prisma/client';
import { z } from 'zod';

export const listTransfersQuerySchema = z.object({
  status: z.nativeEnum(TransferStatus).optional(),
  sourceBranchId: z.string().optional(),
  destBranchId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTransferSchema = z.object({
  sourceBranchId: z.string().min(1),
  destBranchId: z.string().min(1),
  transportMethod: z.string().trim().max(100).optional(),
  driverName: z.string().trim().max(150).optional(),
  driverPhone: z.string().trim().max(20).optional(),
  vehiclePlate: z.string().trim().max(30).optional(),
  etaHours: z.coerce.number().positive().default(12),
  aiSuggested: z.boolean().optional().default(false),
  aiConfidence: z.coerce.number().min(0).max(100).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qtyRequested: z.coerce.number().int().positive(),
      })
    )
    .min(1),
});

export const approveTransferSchema = z.object({
  adjustedItems: z
    .array(
      z.object({
        detailId: z.string().min(1),
        qtyRequested: z.coerce.number().int().positive(),
      })
    )
    .optional(),
});

export const receiveTransferSchema = z.object({
  targetBinId: z.string().min(1),
  items: z
    .array(
      z.object({
        detailId: z.string().min(1),
        qtyReceived: z.coerce.number().int().min(0),
        discrepancyReason: z.string().trim().max(500).optional().nullable(),
      })
    )
    .min(1),
});

export const updateTransferGpsSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  speedKmh: z.coerce.number().min(0).max(200).optional().default(55),
  temperatureC: z.coerce.number().min(-40).max(60).optional(),
  note: z.string().trim().max(255).optional(),
});

export type ListTransfersQuery = z.infer<typeof listTransfersQuerySchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ApproveTransferInput = z.infer<typeof approveTransferSchema>;
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;
export type UpdateTransferGpsInput = z.infer<typeof updateTransferGpsSchema>;
