import { AuditActionType, Prisma, TicketStatus, TicketType } from '@prisma/client';
import { prisma } from '../../config/database';
import { recordAuditLog } from '../../utils/audit';
import {
  CreateTicketInput,
  ListStocksQuery,
  ListTicketsQuery,
} from './inventory.schema';

export class InventoryDomainError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InventoryService {
  async listStocks(query: ListStocksQuery, userBranchId: bigint | null, isAdmin: boolean) {
    const where: Prisma.StockWhereInput = {};
    if (query.branchId) {
      where.branchId = BigInt(query.branchId);
    } else if (!isAdmin && userBranchId) {
      where.branchId = userBranchId;
    }

    if (query.categoryId) {
      where.product = { categoryId: BigInt(query.categoryId) };
    }

    if (query.search) {
      where.OR = [
        { batchNo: { contains: query.search, mode: 'insensitive' } },
        {
          product: {
            OR: [
              { sku: { contains: query.search, mode: 'insensitive' } },
              { barcode: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (query.expiringSoonDays) {
      const targetDate = new Date(Date.now() + query.expiringSoonDays * 24 * 60 * 60 * 1000);
      where.expDate = { lte: targetDate, not: null };
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rawItems] = await prisma.$transaction([
      prisma.stock.count({ where }),
      prisma.stock.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ expDate: 'asc' }, { updatedAt: 'desc' }],
        include: {
          branch: { select: { id: true, code: true, name: true } },
          product: {
            select: {
              id: true,
              sku: true,
              barcode: true,
              name: true,
              unit: true,
              unitPrice: true,
              minStock: true,
              maxStock: true,
              category: { select: { id: true, name: true } },
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
      }),
    ]);

    let items = rawItems.map((s) => ({
      id: s.id,
      branchId: s.branchId,
      branch: s.branch,
      productId: s.productId,
      product: {
        ...s.product,
        unitPrice: Number(s.product.unitPrice),
      },
      binId: s.binId,
      bin: s.bin,
      batchNo: s.batchNo,
      expDate: s.expDate,
      qtyOnHand: s.qtyOnHand,
      qtyReserved: s.qtyReserved,
      qtyAvailable: s.qtyOnHand - s.qtyReserved,
      isLocked: s.isLocked,
      updatedAt: s.updatedAt,
    }));

    if (query.lowStockOnly) {
      items = items.filter((i) => i.qtyAvailable <= i.product.minStock);
    }

    return {
      items,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async suggestBins(branchId: bigint) {
    const bins = await prisma.bin.findMany({
      where: { zone: { branchId }, status: 'ACTIVE' },
      include: {
        zone: { select: { code: true, name: true } },
        stocks: { select: { qtyOnHand: true } },
      },
    });

    return bins
      .map((b) => {
        const used = b.stocks.reduce((acc, s) => acc + s.qtyOnHand, 0);
        const cap = Number(b.maxCapacity);
        return {
          id: b.id,
          code: b.code,
          zoneCode: b.zone.code,
          zoneName: b.zone.name,
          maxCapacity: cap,
          usedQty: used,
          remainingCapacity: Math.max(0, cap - used),
        };
      })
      .sort((a, b) => b.remainingCapacity - a.remainingCapacity);
  }

  async getFefoPickingList(branchId: bigint, productId?: bigint) {
    const stocks = await prisma.stock.findMany({
      where: {
        branchId,
        ...(productId ? { productId } : {}),
        qtyOnHand: { gt: 0 },
      },
      orderBy: [{ expDate: 'asc' }, { updatedAt: 'asc' }],
      include: {
        product: { select: { id: true, sku: true, barcode: true, name: true, unit: true } },
        bin: { select: { id: true, code: true, zone: { select: { code: true, name: true } } } },
      },
    });

    return stocks
      .map((s) => ({
        stockId: s.id,
        product: s.product,
        bin: s.bin,
        batchNo: s.batchNo,
        expDate: s.expDate,
        qtyOnHand: s.qtyOnHand,
        qtyReserved: s.qtyReserved,
        qtyAvailable: s.qtyOnHand - s.qtyReserved,
        isLocked: s.isLocked,
      }))
      .filter((item) => item.qtyAvailable > 0);
  }

  async listTickets(query: ListTicketsQuery, userBranchId: bigint | null, isAdmin: boolean) {
    const where: Prisma.InventoryTicketWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.branchId) {
      where.branchId = BigInt(query.branchId);
    } else if (!isAdmin && userBranchId) {
      where.branchId = userBranchId;
    }

    const skip = (query.page - 1) * query.limit;
    const [total, items] = await prisma.$transaction([
      prisma.inventoryTicket.count({ where }),
      prisma.inventoryTicket.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { id: true, code: true, name: true } },
          creator: { select: { id: true, fullName: true, username: true } },
          details: {
            include: {
              product: { select: { id: true, sku: true, barcode: true, name: true, unit: true } },
              bin: { select: { id: true, code: true } },
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async createTicket(
    input: CreateTicketInput,
    actorId: bigint,
    userBranchId: bigint | null,
    isAdmin: boolean,
    ipAddress: string | null
  ) {
    const branchId = BigInt(input.branchId);
    if (!isAdmin && userBranchId && userBranchId !== branchId) {
      throw new InventoryDomainError(
        'BRANCH_ISOLATION_VIOLATION',
        'Bạn chỉ được phép lập phiếu tại chi nhánh được phân công công tác',
        403
      );
    }

    const prefix = input.type === TicketType.IMPORT ? 'PNK' : input.type === TicketType.EXPORT ? 'PXK' : 'PDC';
    const code = `${prefix}-${Date.now().toString().slice(-8)}`;

    const created = await prisma.inventoryTicket.create({
      data: {
        code,
        type: input.type,
        branchId,
        status: TicketStatus.DRAFT,
        createdBy: actorId,
        supplierName: input.supplierName ?? null,
        reason: input.reason ?? null,
        details: {
          create: input.details.map((d) => ({
            productId: BigInt(d.productId),
            binId: BigInt(d.binId),
            batchNo: d.batchNo,
            expDate: d.expDate ? new Date(d.expDate) : null,
            qty: d.qty,
          })),
        },
      },
      include: { details: true },
    });

    if (input.confirmImmediately) {
      return this.confirmTicket(created.id, actorId, userBranchId, isAdmin, ipAddress);
    }

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'INVENTORY_TICKET',
      newData: { id: created.id.toString(), code: created.code, type: created.type },
      ipAddress,
    });

    return created;
  }

  async confirmTicket(
    ticketId: bigint,
    actorId: bigint,
    userBranchId: bigint | null,
    isAdmin: boolean,
    ipAddress: string | null
  ) {
    const ticket = await prisma.inventoryTicket.findUnique({
      where: { id: ticketId },
      include: {
        details: {
          include: {
            product: { select: { sku: true, name: true } },
            bin: { select: { code: true, maxCapacity: true } },
          },
        },
      },
    });

    if (!ticket) {
      throw new InventoryDomainError('TICKET_NOT_FOUND', 'Không tìm thấy phiếu kho', 404);
    }

    if (!isAdmin && userBranchId && userBranchId !== ticket.branchId) {
      throw new InventoryDomainError(
        'BRANCH_ISOLATION_VIOLATION',
        'Không có quyền xác nhận phiếu của chi nhánh khác',
        403
      );
    }

    if (ticket.status === TicketStatus.COMPLETED) {
      throw new InventoryDomainError('ALREADY_COMPLETED', 'Phiếu đã được xác nhận trước đó', 400);
    }

    const updatedTicket = await prisma.$transaction(async (tx) => {
      for (const line of ticket.details) {
        const existingStock = await tx.stock.findUnique({
          where: {
            branchId_productId_binId_batchNo: {
              branchId: ticket.branchId,
              productId: line.productId,
              binId: line.binId,
              batchNo: line.batchNo,
            },
          },
        });

        if (existingStock?.isLocked) {
          throw new InventoryDomainError(
            'STOCK_LOCKED_BY_AUDIT',
            `Sản phẩm ${line.product.sku} tại kệ ${line.bin.code} đang bị khóa do kiểm kê`,
            409
          );
        }

        if (ticket.type === TicketType.IMPORT) {
          // PB07: Kiểm tra sức chứa kệ
          const currentBinAgg = await tx.stock.aggregate({
            where: { binId: line.binId },
            _sum: { qtyOnHand: true },
          });
          const currentBinQty = currentBinAgg._sum.qtyOnHand ?? 0;
          if (currentBinQty + line.qty > Number(line.bin.maxCapacity)) {
            throw new InventoryDomainError(
              'BIN_CAPACITY_EXCEEDED',
              `Kệ ${line.bin.code} không đủ sức chứa (Hiện tại: ${currentBinQty}, Nhập: ${line.qty}, Tối đa: ${Number(line.bin.maxCapacity)})`,
              400
            );
          }

          await tx.stock.upsert({
            where: {
              branchId_productId_binId_batchNo: {
                branchId: ticket.branchId,
                productId: line.productId,
                binId: line.binId,
                batchNo: line.batchNo,
              },
            },
            update: {
              qtyOnHand: { increment: line.qty },
              ...(line.expDate ? { expDate: line.expDate } : {}),
            },
            create: {
              branchId: ticket.branchId,
              productId: line.productId,
              binId: line.binId,
              batchNo: line.batchNo,
              expDate: line.expDate,
              qtyOnHand: line.qty,
              qtyReserved: 0,
            },
          });
        } else if (ticket.type === TicketType.EXPORT) {
          // PB08: Kiểm tra tồn khả dụng (OnHand - Reserved)
          if (!existingStock) {
            throw new InventoryDomainError(
              'INSUFFICIENT_STOCK',
              `Không tìm thấy tồn kho của ${line.product.sku} tại kệ ${line.bin.code} (Lô: ${line.batchNo})`,
              400
            );
          }

          const available = existingStock.qtyOnHand - existingStock.qtyReserved;
          if (line.qty > available) {
            throw new InventoryDomainError(
              'INSUFFICIENT_STOCK',
              `Số lượng tồn khả dụng không đủ để xuất kho cho ${line.product.sku} (Hiện còn: ${available})`,
              400
            );
          }

          await tx.stock.update({
            where: { id: existingStock.id },
            data: { qtyOnHand: { decrement: line.qty } },
          });
        }
      }

      return tx.inventoryTicket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.COMPLETED,
          approvedBy: actorId,
        },
        include: {
          branch: { select: { code: true, name: true } },
          details: {
            include: {
              product: { select: { sku: true, name: true, unit: true } },
              bin: { select: { code: true } },
            },
          },
        },
      });
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.APPROVE,
      module: 'INVENTORY_TICKET',
      newData: { id: updatedTicket.id.toString(), code: updatedTicket.code, status: 'COMPLETED' },
      ipAddress,
    });

    return updatedTicket;
  }
}

export const inventoryService = new InventoryService();
