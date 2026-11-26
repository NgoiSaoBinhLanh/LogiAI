import { OrderStatus, TicketType, TransferStatus } from '@prisma/client';
import { prisma } from '../../config/database';

export type PeriodFilter = 'week' | 'month' | 'quarter';

export class AnalyticsService {
  async getKpis(period: PeriodFilter, branchId?: string) {
    const now = new Date();
    const daysBack = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const sinceDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const branchFilter = branchId ? BigInt(branchId) : undefined;

    const [branches, categories, stocks, orders, transfers, productsCount, recentExportTickets] =
      await Promise.all([
        prisma.branch.findMany({
          where: { ...(branchFilter ? { id: branchFilter } : {}) },
          orderBy: { id: 'asc' },
        }),
        prisma.category.findMany({ orderBy: { id: 'asc' } }),
        prisma.stock.findMany({
          where: { ...(branchFilter ? { branchId: branchFilter } : {}) },
          include: {
            branch: { select: { id: true, code: true, name: true } },
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                categoryId: true,
                unitPrice: true,
                costPrice: true,
                minStock: true,
                maxStock: true,
              },
            },
          },
        }),
        prisma.customerOrder.findMany({
          where: {
            createdAt: { gte: sinceDate },
            ...(branchFilter ? { assignedBranchId: branchFilter } : {}),
          },
          include: {
            details: {
              include: {
                product: { select: { id: true, sku: true, name: true } },
              },
            },
          },
        }),
        prisma.transferTicket.findMany({
          where: {
            createdAt: { gte: sinceDate },
            ...(branchFilter
              ? { OR: [{ sourceBranchId: branchFilter }, { destBranchId: branchFilter }] }
              : {}),
          },
          include: {
            details: { select: { qtyRequested: true } },
          },
        }),
        prisma.product.count(),
        prisma.inventoryTicketDetail.findMany({
          where: {
            ticket: { type: TicketType.EXPORT, createdAt: { gte: thirtyDaysAgo } },
          },
          select: { productId: true },
        }),
      ]);

    // 1. Tổng giá trị tồn kho & phân rã theo chi nhánh
    let totalInventoryValue = 0;
    let totalStockUnits = 0;
    const valueByBranch = new Map<string, { branchCode: string; branchName: string; value: number; qty: number }>();

    for (const b of branches) {
      valueByBranch.set(b.id.toString(), {
        branchCode: b.code,
        branchName: b.name,
        value: 0,
        qty: 0,
      });
    }

    for (const s of stocks) {
      const val = s.qtyOnHand * Number(s.product.costPrice || s.product.unitPrice);
      totalInventoryValue += val;
      totalStockUnits += s.qtyOnHand;
      const entry = valueByBranch.get(s.branchId.toString());
      if (entry) {
        entry.value += val;
        entry.qty += s.qtyOnHand;
      }
    }

    // 2. Tỷ lệ hoàn tất SLA & doanh số bán
    const totalOrders = orders.length;
    const fulfilledOrders = orders.filter(
      (o) => o.status === OrderStatus.SHIPPED || o.status === OrderStatus.DELIVERED
    ).length;
    const onTimeOrders = orders.filter((o) => {
      if (o.status !== OrderStatus.SHIPPED && o.status !== OrderStatus.DELIVERED) return false;
      if (!o.slaDeadline) return true;
      const finishedAt = o.handedOverAt || o.updatedAt;
      return finishedAt <= o.slaDeadline;
    }).length;
    const slaFulfillmentRate =
      totalOrders > 0 ? Math.round((onTimeOrders / totalOrders) * 1000) / 10 : 100;

    let cogsAmount = 0;
    const soldByProduct = new Map<
      string,
      { sku: string; name: string; qtySold: number; revenue: number }
    >();

    for (const o of orders) {
      for (const d of o.details) {
        const key = d.productId.toString();
        const rev = d.qty * Number(d.price);
        cogsAmount += rev;
        const prev = soldByProduct.get(key);
        if (prev) {
          prev.qtySold += d.qty;
          prev.revenue += rev;
        } else {
          soldByProduct.set(key, {
            sku: d.product.sku,
            name: d.product.name,
            qtySold: d.qty,
            revenue: rev,
          });
        }
      }
    }

    // Vòng quay tồn kho (Inventory Turnover Ratio)
    const inventoryTurnoverRatio =
      totalInventoryValue > 0
        ? Math.round((cogsAmount / totalInventoryValue) * (365 / daysBack) * 100) / 100
        : 0;

    // 3. Chi phí vận chuyển liên kho ước tính
    let interBranchTransferCost = 0;
    for (const t of transfers) {
      if (t.status === TransferStatus.CANCELLED) continue;
      const units = t.details.reduce((acc, d) => acc + d.qtyRequested, 0);
      interBranchTransferCost += units * 12000 + 350000;
    }

    // 4. Chuỗi dữ liệu Bar Chart theo bucket thời gian
    const bucketCount = period === 'week' ? 7 : period === 'month' ? 6 : 6;
    const bucketDays = Math.max(1, Math.floor(daysBack / bucketCount));
    const orderTrend: Array<{
      label: string;
      received: number;
      delivered: number;
      slaPct: number;
    }> = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const endMs = now.getTime() - i * bucketDays * 24 * 60 * 60 * 1000;
      const startMs = endMs - bucketDays * 24 * 60 * 60 * 1000;
      const slice = orders.filter(
        (o) => o.createdAt.getTime() >= startMs && o.createdAt.getTime() < endMs
      );
      const deliv = slice.filter(
        (o) => o.status === OrderStatus.SHIPPED || o.status === OrderStatus.DELIVERED
      ).length;
      const labelDate = new Date(endMs);
      orderTrend.push({
        label: `${labelDate.getDate()}/${labelDate.getMonth() + 1}`,
        received: slice.length,
        delivered: deliv,
        slaPct: slice.length > 0 ? Math.round((deliv / slice.length) * 100) : 100,
      });
    }

    // 5. Inventory Heatmap: Chi nhánh (Y) x Nhóm ngành (X) -> Mức độ đầy (%) & số lượng (O(S) single pass)
    const heatmapBranches = branches.map((b) => b.code);
    const heatmapCategories = categories.map((c) => c.name);
    const heatmapCells: Array<[number, number, number, number]> = []; // [catIdx, branchIdx, occupancyPct, qty]

    const qtyByBranchCategory = new Map<string, number>();
    for (const s of stocks) {
      const k = `${s.branchId.toString()}:${s.product.categoryId.toString()}`;
      qtyByBranchCategory.set(k, (qtyByBranchCategory.get(k) ?? 0) + s.qtyOnHand);
    }

    branches.forEach((b, bIdx) => {
      const capPerCat = Math.max(1, Number(b.capacity) / Math.max(1, categories.length));
      const bIdStr = b.id.toString();
      categories.forEach((c, cIdx) => {
        const qty = qtyByBranchCategory.get(`${bIdStr}:${c.id.toString()}`) ?? 0;
        const pct = Math.min(100, Math.round((qty / capPerCat) * 100));
        heatmapCells.push([cIdx, bIdx, pct, qty]);
      });
    });

    // 6. Top 5 bán chạy & Hàng tồn đọng quá hạn (Deadstock / High stock without recent orders)
    const topSelling = Array.from(soldByProduct.values())
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 5);

    const activeSoldProductIds = new Set<string>([
      ...Array.from(soldByProduct.keys()),
      ...recentExportTickets.map((r) => r.productId.toString()),
    ]);

    const expiryThreshold = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const deadstockItems = stocks
      .filter(
        (s) =>
          s.qtyOnHand > 0 &&
          (!activeSoldProductIds.has(s.productId.toString()) ||
            (s.expDate !== null && s.expDate <= expiryThreshold))
      )
      .slice(0, 8)
      .map((s) => ({
        stockId: s.id.toString(),
        sku: s.product.sku,
        productName: s.product.name,
        branchCode: s.branch.code,
        branchName: s.branch.name,
        qtyOnHand: s.qtyOnHand,
        stuckValue: s.qtyOnHand * Number(s.product.costPrice || s.product.unitPrice),
        expDate: s.expDate ? s.expDate.toISOString() : null,
      }));

    const totalStuckCapital = deadstockItems.reduce((acc, d) => acc + d.stuckValue, 0);

    return {
      kpis: {
        totalInventoryValue,
        totalStockUnits,
        inventoryTurnoverRatio,
        slaFulfillmentRate,
        interBranchTransferCost,
        totalOrders,
        fulfilledOrders,
        activeProductsCount: productsCount,
      },
      branchDistribution: Array.from(valueByBranch.values()),
      orderTrend,
      heatmap: {
        branches: heatmapBranches,
        categories: heatmapCategories,
        cells: heatmapCells,
      },
      topSelling,
      deadstock: {
        items: deadstockItems,
        totalStuckCapital,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
