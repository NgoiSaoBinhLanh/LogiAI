import { AuditActionType, EntityStatus, OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { emitOrderUpdated } from '../../sockets/socket.server';
import { recordAuditLog } from '../../utils/audit';
import {
  AllocateOrderInput,
  CreateOrderInput,
  ListOrdersQuery,
  UpdateOrderStageInput,
} from './orders.schema';

export class OrderDomainError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export class OrdersService {
  async list(query: ListOrdersQuery, userBranchId: bigint | null, isAdmin: boolean) {
    const where: Prisma.CustomerOrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.channel) where.channel = query.channel;
    if (query.branchId) {
      where.assignedBranchId = BigInt(query.branchId);
    } else if (!isAdmin && userBranchId) {
      where.OR = [{ assignedBranchId: userBranchId }, { assignedBranchId: null }];
    }

    if (query.search) {
      where.AND = [
        {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' } },
            { customerName: { contains: query.search, mode: 'insensitive' } },
            { customerAddress: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [total, items] = await prisma.$transaction([
      prisma.customerOrder.count({ where }),
      prisma.customerOrder.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedBranch: { select: { id: true, code: true, name: true } },
          details: {
            include: {
              product: { select: { id: true, sku: true, barcode: true, name: true, unit: true } },
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((o) => ({
        ...o,
        lat: o.lat ? Number(o.lat) : null,
        lng: o.lng ? Number(o.lng) : null,
        totalAmount: Number(o.totalAmount),
        details: o.details.map((d) => ({ ...d, price: Number(d.price) })),
      })),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(input: CreateOrderInput, actorId: bigint, ipAddress: string | null) {
    const code = `ORD-${Date.now().toString().slice(-8)}`;
    const totalAmount = input.items.reduce((acc, i) => acc + i.qty * i.price, 0);

    const order = await prisma.customerOrder.create({
      data: {
        code,
        channel: input.channel,
        customerName: input.customerName,
        customerAddress: input.customerAddress,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        status: OrderStatus.NEW,
        totalAmount,
        details: {
          create: input.items.map((i) => ({
            productId: BigInt(i.productId),
            qty: i.qty,
            price: i.price,
          })),
        },
      },
      include: { details: true },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'CUSTOMER_ORDER',
      newData: { id: order.id.toString(), code: order.code, totalAmount },
      ipAddress,
    });

    return order;
  }

  async suggestBranches(orderId: bigint) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: { details: { include: { product: { select: { sku: true, name: true } } } } },
    });

    if (!order) {
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng', 404);
    }

    const activeBranches = await prisma.branch.findMany({
      where: { status: EntityStatus.ACTIVE },
      include: {
        stocks: {
          where: {
            productId: { in: order.details.map((d) => d.productId) },
            isLocked: false,
          },
        },
      },
    });

    const suggestions = activeBranches.map((branch) => {
      const stockByProduct = new Map<string, number>();
      for (const s of branch.stocks) {
        const key = s.productId.toString();
        const avail = Math.max(0, s.qtyOnHand - s.qtyReserved);
        stockByProduct.set(key, (stockByProduct.get(key) ?? 0) + avail);
      }

      const missingItems: Array<{ sku: string; required: number; available: number }> = [];
      let canFulfillAll = true;

      for (const line of order.details) {
        const avail = stockByProduct.get(line.productId.toString()) ?? 0;
        if (avail < line.qty) {
          canFulfillAll = false;
          missingItems.push({
            sku: line.product.sku,
            required: line.qty,
            available: avail,
          });
        }
      }

      const distanceKm =
        order.lat !== null && order.lng !== null
          ? haversineDistanceKm(
              Number(order.lat),
              Number(order.lng),
              Number(branch.latitude),
              Number(branch.longitude)
            )
          : null;

      return {
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        branchType: branch.branchType,
        canFulfillAll,
        distanceKm,
        missingItems,
      };
    });

    suggestions.sort((a, b) => {
      if (a.canFulfillAll !== b.canFulfillAll) return a.canFulfillAll ? -1 : 1;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return 0;
    });

    return suggestions;
  }

  async allocate(
    orderId: bigint,
    input: AllocateOrderInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: { details: { include: { product: { select: { sku: true } } } } },
    });

    if (!order) {
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng', 404);
    }

    if (order.status !== OrderStatus.NEW) {
      throw new OrderDomainError('ALREADY_ALLOCATED', 'Đơn hàng đã được phân bổ trước đó', 400);
    }

    const branchId = BigInt(input.branchId);
    const slaDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000); // Cam kết SLA đóng gói 2 giờ (PB12)

    const updated = await prisma.$transaction(async (tx) => {
      for (const line of order.details) {
        const stocks = await tx.stock.findMany({
          where: { branchId, productId: line.productId, isLocked: false },
          orderBy: [{ expDate: 'asc' }, { id: 'asc' }],
        });

        const totalAvail = stocks.reduce(
          (acc, s) => acc + Math.max(0, s.qtyOnHand - s.qtyReserved),
          0
        );

        if (totalAvail < line.qty) {
          throw new OrderDomainError(
            'INSUFFICIENT_BRANCH_STOCK',
            `Chi nhánh được chọn không đủ tồn khả dụng cho ${line.product.sku} (Cần: ${line.qty}, Còn: ${totalAvail})`,
            400
          );
        }

        // Giữ chỗ tồn kho (Reserved Stock - PB11)
        let rem = line.qty;
        for (const s of stocks) {
          if (rem <= 0) break;
          const avail = Math.max(0, s.qtyOnHand - s.qtyReserved);
          if (avail <= 0) continue;
          const take = Math.min(avail, rem);
          await tx.stock.update({
            where: { id: s.id },
            data: { qtyReserved: { increment: take } },
          });
          rem -= take;
        }
      }

      return tx.customerOrder.update({
        where: { id: orderId },
        data: {
          assignedBranchId: branchId,
          status: OrderStatus.ALLOCATED,
          slaDeadline,
        },
        include: {
          assignedBranch: { select: { id: true, code: true, name: true } },
        },
      });
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'ORDER_ALLOCATE',
      newData: {
        orderCode: order.code,
        assignedBranchId: branchId.toString(),
        status: 'ALLOCATED',
      },
      ipAddress,
    });

    emitOrderUpdated({
      id: updated.id.toString(),
      code: updated.code,
      status: updated.status,
      assignedBranchId: updated.assignedBranchId?.toString() ?? null,
      pickingProgress: updated.pickingProgress,
      trackingNumber: updated.trackingNumber,
    });

    return updated;
  }

  async getBoard(branchId: string | undefined, userBranchId: bigint | null, isAdmin: boolean) {
    const where: Prisma.CustomerOrderWhereInput = {
      status: {
        in: [
          OrderStatus.ALLOCATED,
          OrderStatus.PACKING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ],
      },
    };

    if (branchId) {
      where.assignedBranchId = BigInt(branchId);
    } else if (!isAdmin && userBranchId) {
      where.assignedBranchId = userBranchId;
    }

    const orders = await prisma.customerOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        assignedBranch: { select: { id: true, code: true, name: true } },
        details: {
          include: {
            product: { select: { id: true, sku: true, name: true, unit: true } },
          },
        },
      },
    });

    const now = Date.now();
    return orders.map((o) => {
      const deadlineMs = o.slaDeadline ? o.slaDeadline.getTime() : o.createdAt.getTime() + 2 * 60 * 60 * 1000;
      const diffMinutes = Math.round((deadlineMs - now) / 60000);
      const isFinal = o.status === OrderStatus.SHIPPED || o.status === OrderStatus.DELIVERED;
      const slaStatus: 'ON_TIME' | 'AT_RISK' | 'BREACHED' = isFinal
        ? 'ON_TIME'
        : diffMinutes < 0
        ? 'BREACHED'
        : diffMinutes <= 30
        ? 'AT_RISK'
        : 'ON_TIME';

      return {
        ...o,
        lat: o.lat ? Number(o.lat) : null,
        lng: o.lng ? Number(o.lng) : null,
        totalAmount: Number(o.totalAmount),
        slaStatus,
        slaRemainingMinutes: diffMinutes,
        details: o.details.map((d) => ({ ...d, price: Number(d.price) })),
      };
    });
  }

  async updateStage(
    orderId: bigint,
    input: UpdateOrderStageInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: { details: true },
    });

    if (!order) {
      throw new OrderDomainError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng', 404);
    }

    if (order.status === OrderStatus.NEW || !order.assignedBranchId) {
      throw new OrderDomainError(
        'NOT_ALLOCATED',
        'Đơn hàng phải được phân bổ về chi nhánh trước khi nhặt và đóng gói (PB12)',
        400
      );
    }

    const nextStatus = input.status as OrderStatus;
    const progress =
      input.pickingProgress ??
      (nextStatus === OrderStatus.ALLOCATED
        ? 10
        : nextStatus === OrderStatus.PACKING
        ? 60
        : 100);

    const wasNotShipped =
      order.status === OrderStatus.ALLOCATED || order.status === OrderStatus.PACKING;
    const movingToShippedOrDelivered =
      nextStatus === OrderStatus.SHIPPED || nextStatus === OrderStatus.DELIVERED;

    const updated = await prisma.$transaction(async (tx) => {
      // Khi bàn giao vận chuyển lần đầu -> trừ tồn thực & giải phóng tồn giữ chỗ (Reserved)
      if (wasNotShipped && movingToShippedOrDelivered && order.assignedBranchId) {
        for (const line of order.details) {
          let rem = line.qty;
          const stocks = await tx.stock.findMany({
            where: {
              branchId: order.assignedBranchId,
              productId: line.productId,
              qtyOnHand: { gt: 0 },
            },
            orderBy: [{ expDate: 'asc' }, { id: 'asc' }],
          });
          for (const s of stocks) {
            if (rem <= 0) break;
            const take = Math.min(s.qtyOnHand, rem);
            const decRes = Math.min(s.qtyReserved, take);
            await tx.stock.update({
              where: { id: s.id },
              data: {
                qtyOnHand: { decrement: take },
                qtyReserved: { decrement: decRes },
              },
            });
            rem -= take;
          }
        }
      }

      const autoTracking =
        input.trackingNumber ??
        (movingToShippedOrDelivered && !order.trackingNumber
          ? `VNP-${order.code.replace('ORD-', '')}`
          : order.trackingNumber);

      return tx.customerOrder.update({
        where: { id: orderId },
        data: {
          status: nextStatus,
          pickingProgress: progress,
          trackingNumber: autoTracking,
          carrierName:
            input.carrierName ??
            (movingToShippedOrDelivered && !order.carrierName
              ? 'Giao Hàng Nhanh (GHN)'
              : order.carrierName),
          ...(nextStatus === OrderStatus.PACKING && !order.packedAt ? { packedAt: new Date() } : {}),
          ...(nextStatus === OrderStatus.SHIPPED && !order.handedOverAt
            ? { handedOverAt: new Date() }
            : {}),
        },
        include: {
          assignedBranch: { select: { id: true, code: true, name: true } },
        },
      });
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'ORDER_KANBAN',
      oldData: { status: order.status },
      newData: { status: updated.status, trackingNumber: updated.trackingNumber },
      ipAddress,
    });

    emitOrderUpdated({
      id: updated.id.toString(),
      code: updated.code,
      status: updated.status,
      assignedBranchId: updated.assignedBranchId?.toString() ?? null,
      pickingProgress: updated.pickingProgress,
      trackingNumber: updated.trackingNumber,
    });

    return updated;
  }
}

export const ordersService = new OrdersService();
