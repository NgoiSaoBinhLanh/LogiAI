import { BinStatus, BranchType, EntityStatus } from '@prisma/client';
import { z } from 'zod';

export const createBranchSchema = z.object({
  code: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(255),
  branchType: z.nativeEnum(BranchType).default(BranchType.SATELLITE),
  address: z.string().trim().min(5).max(500),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  capacity: z.coerce.number().positive(),
  managerPhone: z.string().trim().max(20).optional().nullable(),
});

export const updateBranchSchema = createBranchSchema.partial();

export const updateBranchStatusSchema = z.object({
  status: z.nativeEnum(EntityStatus),
});

export const createZoneSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(150),
});

export const createBinSchema = z.object({
  code: z.string().trim().min(1).max(50),
  maxCapacity: z.coerce.number().positive(),
  status: z.nativeEnum(BinStatus).optional().default(BinStatus.ACTIVE),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type CreateBinInput = z.infer<typeof createBinSchema>;
