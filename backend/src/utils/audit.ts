import { AuditActionType, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface AuditLogInput {
  userId?: bigint | null;
  actionType: AuditActionType;
  module: string;
  oldData?: Prisma.InputJsonValue | null;
  newData?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.systemAuditLog.create({
      data: {
        userId: input.userId ?? null,
        actionType: input.actionType,
        module: input.module,
        oldData: input.oldData ?? Prisma.JsonNull,
        newData: input.newData ?? Prisma.JsonNull,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err: unknown) {
    logger.warn('Failed to write system audit log', {
      module: input.module,
      actionType: input.actionType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
