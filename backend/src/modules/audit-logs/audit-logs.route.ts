import { AuditActionType, Prisma } from '@prisma/client';
import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { sendSuccess } from '../../utils/response';

const listAuditLogsQuerySchema = z.object({
  search: z.string().optional(),
  module: z.string().optional(),
  actionType: z.nativeEnum(AuditActionType).optional(),
  userId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const router = Router();

router.use(authenticate);
router.use(requirePermissions('AUDIT_READ'));

router.get(
  '/',
  validateRequest({ query: listAuditLogsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = listAuditLogsQuerySchema.parse(req.query);
      const where: Prisma.SystemAuditLogWhereInput = {};

      if (q.module) where.module = { equals: q.module, mode: 'insensitive' };
      if (q.actionType) where.actionType = q.actionType;
      if (q.userId) where.userId = BigInt(q.userId);

      if (q.fromDate || q.toDate) {
        where.createdAt = {
          ...(q.fromDate ? { gte: new Date(q.fromDate) } : {}),
          ...(q.toDate ? { lte: new Date(q.toDate) } : {}),
        };
      }

      if (q.search) {
        where.OR = [
          { module: { contains: q.search, mode: 'insensitive' } },
          { ipAddress: { contains: q.search, mode: 'insensitive' } },
          {
            user: {
              OR: [
                { username: { contains: q.search, mode: 'insensitive' } },
                { fullName: { contains: q.search, mode: 'insensitive' } },
              ],
            },
          },
        ];
      }

      const skip = (q.page - 1) * q.limit;
      const [total, items] = await prisma.$transaction([
        prisma.systemAuditLog.count({ where }),
        prisma.systemAuditLog.findMany({
          where,
          skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                role: { select: { roleCode: true, roleName: true } },
              },
            },
          },
        }),
      ]);

      sendSuccess(res, {
        items,
        pagination: {
          total,
          page: q.page,
          limit: q.limit,
          totalPages: Math.ceil(total / q.limit),
        },
      });
    } catch (err: unknown) {
      next(err);
    }
  }
);

export const auditLogsRouter = router;
