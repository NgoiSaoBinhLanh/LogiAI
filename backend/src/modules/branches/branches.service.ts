import { AuditActionType, EntityStatus, OrderStatus, TransferStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { recordAuditLog } from '../../utils/audit';
import {
  CreateBinInput,
  CreateBranchInput,
  CreateZoneInput,
  UpdateBranchInput,
} from './branches.schema';

export class BranchDomainError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class BranchesService {
  async listBranches() {
    const [branches, stocks] = await Promise.all([
      prisma.branch.findMany({
        orderBy: { id: 'asc' },
        include: {
          zones: {
            orderBy: { id: 'asc' },
            include: {
              bins: {
                orderBy: { id: 'asc' },
              },
            },
          },
          _count: {
            select: { users: true, zones: true },
          },
        },
      }),
      prisma.stock.findMany({
        where: { qtyOnHand: { gt: 0 } },
        select: {
          branchId: true,
          binId: true,
          productId: true,
          qtyOnHand: true,
          product: { select: { unitPrice: true } },
        },
      }),
    ]);

    const branchTotals = new Map<
      string,
      { totalQty: number; totalValue: number; distinctSkus: Set<string> }
    >();
    const binQtyMap = new Map<string, number>();

    for (const s of stocks) {
      const bKey = s.branchId.toString();
      let bStats = branchTotals.get(bKey);
      if (!bStats) {
        bStats = { totalQty: 0, totalValue: 0, distinctSkus: new Set<string>() };
        branchTotals.set(bKey, bStats);
      }
      bStats.distinctSkus.add(s.productId.toString());
      bStats.totalQty += s.qtyOnHand;
      bStats.totalValue += s.qtyOnHand * Number(s.product.unitPrice);

      const binKey = s.binId.toString();
      binQtyMap.set(binKey, (binQtyMap.get(binKey) ?? 0) + s.qtyOnHand);
    }

    return branches.map((b) => {
      const bStats = branchTotals.get(b.id.toString());
      const totalQty = bStats?.totalQty ?? 0;
      const totalValue = bStats?.totalValue ?? 0;
      const distinctSkus = bStats?.distinctSkus ?? new Set<string>();

      const cap = Number(b.capacity);
      const occupancyPct = cap > 0 ? Math.min(100, Math.round((totalQty / cap) * 1000) / 10) : 0;

      const formattedZones = b.zones.map((z) => ({
        id: z.id,
        branchId: z.branchId,
        code: z.code,
        name: z.name,
        bins: z.bins.map((bin) => {
          const binQty = binQtyMap.get(bin.id.toString()) ?? 0;
          const binCap = Number(bin.maxCapacity);
          const binPct = binCap > 0 ? Math.min(100, Math.round((binQty / binCap) * 100)) : 0;
          return {
            id: bin.id,
            zoneId: bin.zoneId,
            code: bin.code,
            maxCapacity: bin.maxCapacity,
            status: bin.status,
            currentQty: binQty,
            occupancyPct: binPct,
          };
        }),
      }));

      return {
        id: b.id,
        code: b.code,
        name: b.name,
        branchType: b.branchType,
        address: b.address,
        latitude: Number(b.latitude),
        longitude: Number(b.longitude),
        capacity: Number(b.capacity),
        managerPhone: b.managerPhone,
        status: b.status,
        totalQty,
        totalValue,
        skuCount: distinctSkus.size,
        occupancyPct,
        userCount: b._count.users,
        zoneCount: b._count.zones,
        zones: formattedZones,
      };
    });
  }

  async createBranch(input: CreateBranchInput, actorId: bigint, ipAddress: string | null) {
    const dup = await prisma.branch.findUnique({ where: { code: input.code } });
    if (dup) {
      throw new BranchDomainError('DUPLICATE_BRANCH_CODE', 'Mã chi nhánh đã tồn tại trong hệ thống', 409);
    }

    const branch = await prisma.branch.create({
      data: {
        code: input.code,
        name: input.name,
        branchType: input.branchType,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        capacity: input.capacity,
        managerPhone: input.managerPhone ?? null,
      },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'BRANCH',
      newData: { id: branch.id.toString(), code: branch.code, name: branch.name },
      ipAddress,
    });

    return branch;
  }

  async updateBranch(
    branchId: bigint,
    input: UpdateBranchInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const existing = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!existing) {
      throw new BranchDomainError('BRANCH_NOT_FOUND', 'Không tìm thấy chi nhánh', 404);
    }

    if (input.code && input.code !== existing.code) {
      const dup = await prisma.branch.findFirst({
        where: { code: input.code, NOT: { id: branchId } },
      });
      if (dup) {
        throw new BranchDomainError('DUPLICATE_BRANCH_CODE', 'Mã chi nhánh đã tồn tại', 409);
      }
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.branchType !== undefined ? { branchType: input.branchType } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.managerPhone !== undefined ? { managerPhone: input.managerPhone } : {}),
      },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'BRANCH',
      oldData: { name: existing.name, capacity: Number(existing.capacity) },
      newData: { name: updated.name, capacity: Number(updated.capacity) },
      ipAddress,
    });

    return updated;
  }

  async updateBranchStatus(
    branchId: bigint,
    status: EntityStatus,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const existing = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!existing) {
      throw new BranchDomainError('BRANCH_NOT_FOUND', 'Không tìm thấy chi nhánh', 404);
    }

    // PB04 Constraint: Chặn ngừng hoạt động nếu còn tồn kho > 0 hoặc còn lệnh điều chuyển / đơn đang xử lý
    if (status === EntityStatus.INACTIVE || status === EntityStatus.SUSPENDED) {
      const [stockAgg, activeTransfers, activeOrders] = await Promise.all([
        prisma.stock.aggregate({
          where: { branchId, qtyOnHand: { gt: 0 } },
          _sum: { qtyOnHand: true },
          _count: { id: true },
        }),
        prisma.transferTicket.count({
          where: {
            OR: [{ sourceBranchId: branchId }, { destBranchId: branchId }],
            status: { in: [TransferStatus.PENDING, TransferStatus.APPROVED, TransferStatus.IN_TRANSIT] },
          },
        }),
        prisma.customerOrder.count({
          where: {
            assignedBranchId: branchId,
            status: { in: [OrderStatus.NEW, OrderStatus.ALLOCATED, OrderStatus.PACKING] },
          },
        }),
      ]);

      const totalStock = stockAgg._sum.qtyOnHand ?? 0;
      if (totalStock > 0 || activeTransfers > 0 || activeOrders > 0) {
        throw new BranchDomainError(
          'BRANCH_CLOSE_BLOCKED',
          'Không thể đóng cửa/ngừng hoạt động chi nhánh còn hàng tồn hoặc giao dịch chưa hoàn tất',
          409,
          {
            totalStock,
            stockRows: stockAgg._count.id,
            activeTransfers,
            activeOrders,
          }
        );
      }
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: { status },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'BRANCH_STATUS',
      oldData: { status: existing.status },
      newData: { status: updated.status },
      ipAddress,
    });

    return updated;
  }

  async createZone(
    branchId: bigint,
    input: CreateZoneInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const dup = await prisma.zone.findUnique({
      where: { branchId_code: { branchId, code: input.code } },
    });
    if (dup) {
      throw new BranchDomainError('DUPLICATE_ZONE', 'Mã khu vực đã tồn tại trong chi nhánh', 409);
    }

    const zone = await prisma.zone.create({
      data: { branchId, code: input.code, name: input.name },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'ZONE',
      newData: { branchId: branchId.toString(), code: zone.code },
      ipAddress,
    });

    return zone;
  }

  async createBin(
    zoneId: bigint,
    input: CreateBinInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const dup = await prisma.bin.findUnique({
      where: { zoneId_code: { zoneId, code: input.code } },
    });
    if (dup) {
      throw new BranchDomainError('DUPLICATE_BIN', 'Mã kệ đã tồn tại trong khu vực này', 409);
    }

    const bin = await prisma.bin.create({
      data: {
        zoneId,
        code: input.code,
        maxCapacity: input.maxCapacity,
        status: input.status,
      },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'BIN',
      newData: { zoneId: zoneId.toString(), code: bin.code },
      ipAddress,
    });

    return bin;
  }
}

export const branchesService = new BranchesService();
