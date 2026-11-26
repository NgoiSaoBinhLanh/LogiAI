import { AuditActionType, Prisma, StockCheckStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { emitApprovalNotification } from '../../sockets/socket.server';
import { recordAuditLog } from '../../utils/audit';
import {
  CreateStockCheckInput,
  ListStockChecksQuery,
  RejectStockCheckInput,
  UpdateStockCheckCountInput,
} from './stock-checks.schema';

export class StockCheckDomainError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class StockChecksService {
  async list(query: ListStockChecksQuery, userBranchId: bigint | null, isAdmin: boolean) {
    const where: Prisma.StockCheckWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.branchId) {
      where.branchId = BigInt(query.branchId);
    } else if (!isAdmin && userBranchId) {
      where.branchId = userBranchId;
    }

    const skip = (query.page - 1) * query.limit;
    const [total, items] = await prisma.$transaction([
      prisma.stockCheck.count({ where }),
      prisma.stockCheck.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { id: true, code: true, name: true } },
          creator: { select: { id: true, fullName: true, username: true } },
          approver: { select: { id: true, fullName: true, username: true } },
          details: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  barcode: true,
                  name: true,
                  unit: true,
                  costPrice: true,
                },
              },
              bin: {
                select: {
                  id: true,
                  code: true,
                  zone: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((sc) => ({
        ...sc,
        details: sc.details.map((d) => ({
          ...d,
          product: {
            ...d.product,
            costPrice: Number(d.product.costPrice),
          },
        })),
      })),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(
    input: CreateStockCheckInput,
    actorId: bigint,
    userBranchId: bigint | null,
    isAdmin: boolean,
    ipAddress: string | null
  ) {
    const branchId = BigInt(input.branchId);
    if (!isAdmin && userBranchId && userBranchId !== branchId) {
      throw new StockCheckDomainError(
        'BRANCH_ISOLATION_VIOLATION',
        'Chỉ được phép tạo đợt kiểm kê tại chi nhánh công tác',
        403
      );
    }

    const stockWhere: Prisma.StockWhereInput = {
      branchId,
      ...(input.zoneId ? { bin: { zoneId: BigInt(input.zoneId) } } : {}),
    };

    const stocks = await prisma.stock.findMany({
      where: stockWhere,
      orderBy: { id: 'asc' },
    });

    if (stocks.length === 0) {
      throw new StockCheckDomainError(
        'EMPTY_STOCK_SCOPE',
        'Không có bản ghi tồn kho nào trong phạm vi kiểm kê đã chọn',
        400
      );
    }

    // Gom theo (productId, binId) để phù hợp schema stock_check_detail
    const grouped = new Map<string, { productId: bigint; binId: bigint; qtySystem: number }>();
    for (const s of stocks) {
      const key = `${s.productId.toString()}:${s.binId.toString()}`;
      const prev = grouped.get(key);
      if (prev) {
        prev.qtySystem += s.qtyOnHand;
      } else {
        grouped.set(key, {
          productId: s.productId,
          binId: s.binId,
          qtySystem: s.qtyOnHand,
        });
      }
    }

    const code = `KK-${Date.now().toString().slice(-8)}`;

    const created = await prisma.$transaction(async (tx) => {
      // PB09 Constraint: Khóa tạm giao dịch nhập/xuất các mặt hàng kiểm kê
      await tx.stock.updateMany({
        where: { id: { in: stocks.map((s) => s.id) } },
        data: { isLocked: true },
      });

      return tx.stockCheck.create({
        data: {
          code,
          branchId,
          status: StockCheckStatus.COUNTING,
          createdBy: actorId,
          details: {
            create: Array.from(grouped.values()).map((item) => ({
              productId: item.productId,
              binId: item.binId,
              qtySystem: item.qtySystem,
              qtyActual: item.qtySystem,
              discrepancyQty: 0,
            })),
          },
        },
        include: {
          details: {
            include: {
              product: { select: { id: true, sku: true, barcode: true, name: true, unit: true } },
              bin: { select: { id: true, code: true } },
            },
          },
        },
      });
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'STOCK_CHECK',
      newData: { id: created.id.toString(), code: created.code, itemsLocked: stocks.length },
      ipAddress,
    });

    return created;
  }

  async updateCounts(
    stockCheckId: bigint,
    input: UpdateStockCheckCountInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const check = await prisma.stockCheck.findUnique({
      where: { id: stockCheckId },
      include: { details: true },
    });

    if (!check) {
      throw new StockCheckDomainError('STOCK_CHECK_NOT_FOUND', 'Không tìm thấy phiếu kiểm kê', 404);
    }

    if (check.status !== StockCheckStatus.COUNTING) {
      throw new StockCheckDomainError(
        'INVALID_STATUS',
        'Chỉ có thể cập nhật số lượng khi phiếu đang ở trạng thái Đang kiểm đếm',
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        const detail = check.details.find((d) => d.id.toString() === item.detailId);
        if (!detail) continue;

        const discrepancy = item.qtyActual - detail.qtySystem;
        await tx.stockCheckDetail.update({
          where: { id: detail.id },
          data: {
            qtyActual: item.qtyActual,
            discrepancyQty: discrepancy,
            reason: item.reason ?? detail.reason,
          },
        });
      }
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'STOCK_CHECK',
      newData: { id: check.id.toString(), updatedLines: input.items.length },
      ipAddress,
    });

    return prisma.stockCheck.findUnique({
      where: { id: stockCheckId },
      include: { details: true },
    });
  }

  async submit(stockCheckId: bigint, actorId: bigint, ipAddress: string | null) {
    const check = await prisma.stockCheck.findUnique({ where: { id: stockCheckId } });
    if (!check) {
      throw new StockCheckDomainError('STOCK_CHECK_NOT_FOUND', 'Không tìm thấy phiếu kiểm kê', 404);
    }
    if (check.status !== StockCheckStatus.COUNTING) {
      throw new StockCheckDomainError('INVALID_STATUS', 'Phiếu không ở trạng thái Đang kiểm đếm', 400);
    }

    const updated = await prisma.stockCheck.update({
      where: { id: stockCheckId },
      data: { status: StockCheckStatus.PENDING_APPROVAL },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'STOCK_CHECK',
      oldData: { status: check.status },
      newData: { status: updated.status },
      ipAddress,
    });

    emitApprovalNotification({
      type: 'STOCK_CHECK',
      code: updated.code,
      action: 'SUBMITTED',
      branchId: updated.branchId.toString(),
      message: `Phiếu kiểm kê ${updated.code} đã được gửi lên chờ phê duyệt`,
    });

    return updated;
  }

  async approve(stockCheckId: bigint, actorId: bigint, ipAddress: string | null) {
    const check = await prisma.stockCheck.findUnique({
      where: { id: stockCheckId },
      include: { details: true },
    });

    if (!check) {
      throw new StockCheckDomainError('STOCK_CHECK_NOT_FOUND', 'Không tìm thấy phiếu kiểm kê', 404);
    }

    if (check.status !== StockCheckStatus.PENDING_APPROVAL) {
      throw new StockCheckDomainError(
        'INVALID_STATUS',
        'Phiếu kiểm kê phải ở trạng thái Chờ phê duyệt mới được phép duyệt',
        400
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const detail of check.details) {
        const stocks = await tx.stock.findMany({
          where: {
            branchId: check.branchId,
            productId: detail.productId,
            binId: detail.binId,
          },
          orderBy: { id: 'asc' },
        });

        if (stocks.length > 0) {
          // Điều chỉnh tồn kho theo số lượng thực tế và mở khóa giao dịch
          const diff = detail.qtyActual - detail.qtySystem;
          if (diff !== 0) {
            const firstStock = stocks[0];
            const nextQty = Math.max(0, firstStock.qtyOnHand + diff);
            await tx.stock.update({
              where: { id: firstStock.id },
              data: { qtyOnHand: nextQty, isLocked: false },
            });
          }

          await tx.stock.updateMany({
            where: { id: { in: stocks.map((s) => s.id) } },
            data: { isLocked: false },
          });
        }
      }

      return tx.stockCheck.update({
        where: { id: stockCheckId },
        data: {
          status: StockCheckStatus.APPROVED,
          approvedBy: actorId,
        },
      });
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.APPROVE,
      module: 'STOCK_CHECK',
      oldData: { status: check.status },
      newData: { status: updated.status, code: check.code },
      ipAddress,
    });

    emitApprovalNotification({
      type: 'STOCK_CHECK',
      code: check.code,
      action: 'APPROVED',
      branchId: check.branchId.toString(),
      message: `Phiếu kiểm kê ${check.code} đã được phê duyệt và cân bằng tồn kho`,
    });

    return updated;
  }

  async reject(
    stockCheckId: bigint,
    input: RejectStockCheckInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const check = await prisma.stockCheck.findUnique({ where: { id: stockCheckId } });
    if (!check) {
      throw new StockCheckDomainError('STOCK_CHECK_NOT_FOUND', 'Không tìm thấy phiếu kiểm kê', 404);
    }
    if (check.status !== StockCheckStatus.PENDING_APPROVAL) {
      throw new StockCheckDomainError('INVALID_STATUS', 'Chỉ từ chối phiếu đang chờ phê duyệt', 400);
    }

    const updated = await prisma.stockCheck.update({
      where: { id: stockCheckId },
      data: {
        status: StockCheckStatus.COUNTING,
        rejectReason: input.reason,
        approvedBy: actorId,
      },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.REJECT,
      module: 'STOCK_CHECK',
      oldData: { status: check.status },
      newData: { status: updated.status, rejectReason: input.reason },
      ipAddress,
    });

    emitApprovalNotification({
      type: 'STOCK_CHECK',
      code: check.code,
      action: 'REJECTED',
      branchId: check.branchId.toString(),
      message: `Phiếu kiểm kê ${check.code} bị từ chối: ${input.reason}`,
    });

    return updated;
  }
}

export const stockChecksService = new StockChecksService();
