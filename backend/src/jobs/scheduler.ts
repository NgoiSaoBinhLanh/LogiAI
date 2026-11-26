import cron, { ScheduledTask } from 'node-cron';
import { AlertSeverity, AlertType, OrderStatus, TransferStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emitAlertCreated } from '../sockets/socket.server';

function mapSeverityColor(severity: AlertSeverity): 'RED' | 'YELLOW' {
  return severity === AlertSeverity.CRITICAL || severity === AlertSeverity.HIGH ? 'RED' : 'YELLOW';
}

export interface ScanSummary {
  pb19Created: number;
  pb12Created: number;
  pb14Created: number;
  scannedAt: string;
}

/**
 * PB19: Quét định kỳ phát hiện nguy cơ thiếu hàng (Stock-out / DOI) & tồn kho ứ đọng (Over-stock / Expiring)
 */
export async function runStockAlertScan(): Promise<number> {
  let createdCount = 0;
  try {
    const stocks = await prisma.stock.findMany({
      include: {
        branch: { select: { id: true, code: true, name: true } },
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            minStock: true,
            maxStock: true,
          },
        },
      },
    });

    // Gom tồn khả dụng theo (branchId, productId)
    const grouped = new Map<
      string,
      {
        branchId: bigint;
        branchName: string;
        productId: bigint;
        sku: string;
        productName: string;
        minStock: number;
        maxStock: number;
        totalAvailable: number;
        totalOnHand: number;
        earliestExp: Date | null;
      }
    >();

    for (const s of stocks) {
      const key = `${s.branchId.toString()}:${s.productId.toString()}`;
      const avail = Math.max(0, s.qtyOnHand - s.qtyReserved);
      const prev = grouped.get(key);
      if (prev) {
        prev.totalAvailable += avail;
        prev.totalOnHand += s.qtyOnHand;
        if (s.expDate && (!prev.earliestExp || s.expDate < prev.earliestExp)) {
          prev.earliestExp = s.expDate;
        }
      } else {
        grouped.set(key, {
          branchId: s.branchId,
          branchName: s.branch.name,
          productId: s.productId,
          sku: s.product.sku,
          productName: s.product.name,
          minStock: s.product.minStock,
          maxStock: s.product.maxStock,
          totalAvailable: avail,
          totalOnHand: s.qtyOnHand,
          earliestExp: s.expDate,
        });
      }
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const openAlerts = await prisma.aiAlert.findMany({
      where: {
        isResolved: false,
        alertType: {
          in: [AlertType.LOW_STOCK, AlertType.CAPACITY_WARNING, AlertType.EXPIRING_SOON],
        },
      },
      select: { alertType: true, branchId: true, productId: true },
    });
    const openAlertKeys = new Set(
      openAlerts.map((a) => `${a.alertType}:${a.branchId?.toString() ?? ''}:${a.productId?.toString() ?? ''}`)
    );

    for (const item of grouped.values()) {
      const bStr = item.branchId.toString();
      const pStr = item.productId.toString();

      // 1. Nguy cơ thiếu hàng (Stock-out Risk)
      if (item.minStock > 0 && item.totalAvailable <= item.minStock) {
        const key = `${AlertType.LOW_STOCK}:${bStr}:${pStr}`;
        if (!openAlertKeys.has(key)) {
          const isCritical = item.totalAvailable <= Math.floor(item.minStock * 0.5);
          const severity = isCritical ? AlertSeverity.CRITICAL : AlertSeverity.MEDIUM;
          const estimatedDoi = Math.max(1, Math.round((item.totalAvailable / Math.max(1, item.minStock / 7)) * 10) / 10);

          const alert = await prisma.aiAlert.create({
            data: {
              alertType: AlertType.LOW_STOCK,
              severity,
              branchId: item.branchId,
              productId: item.productId,
              title: `[PB19] Nguy cơ thiếu hàng: ${item.sku} tại ${item.branchName}`,
              message: `Tồn khả dụng còn ${item.totalAvailable} (Min: ${item.minStock}). Chỉ số DOI ước tính: ${estimatedDoi} ngày.`,
              payload: {
                code: 'PB19_LOW_STOCK',
                doiDays: estimatedDoi,
                qtyAvailable: item.totalAvailable,
                minStock: item.minStock,
              },
            },
          });

          openAlertKeys.add(key);
          emitAlertCreated({
            id: alert.id.toString(),
            alertType: alert.alertType,
            severity: alert.severity,
            colorLevel: mapSeverityColor(alert.severity),
            branchId: alert.branchId?.toString() ?? null,
            title: alert.title,
            message: alert.message,
            createdAt: alert.createdAt.toISOString(),
          });
          createdCount++;
        }
      }

      // 2. Nguy cơ tồn kho ứ đọng (Over-stock > 150% maxStock & 30 ngày không phát sinh xuất bán)
      if (item.maxStock > 0 && item.totalOnHand > item.maxStock * 1.5) {
        const key = `${AlertType.CAPACITY_WARNING}:${bStr}:${pStr}`;
        if (!openAlertKeys.has(key)) {
          const recentSales = await prisma.customerOrderDetail.count({
            where: {
              productId: item.productId,
              order: {
                assignedBranchId: item.branchId,
                createdAt: { gte: thirtyDaysAgo },
              },
            },
          });

          if (recentSales === 0) {
            const alert = await prisma.aiAlert.create({
              data: {
                alertType: AlertType.CAPACITY_WARNING,
                severity: AlertSeverity.MEDIUM,
                branchId: item.branchId,
                productId: item.productId,
                title: `[PB19] Hàng tồn ứ đọng (Deadstock): ${item.sku}`,
                message: `Tồn thực ${item.totalOnHand} vượt 150% ngưỡng Max (${item.maxStock}) và 30 ngày chưa có giao dịch bán tại ${item.branchName}.`,
                payload: {
                  code: 'PB19_OVERSTOCK',
                  qtyOnHand: item.totalOnHand,
                  maxStock: item.maxStock,
                },
              },
            });

            openAlertKeys.add(key);
            emitAlertCreated({
              id: alert.id.toString(),
              alertType: alert.alertType,
              severity: alert.severity,
              colorLevel: mapSeverityColor(alert.severity),
              branchId: alert.branchId?.toString() ?? null,
              title: alert.title,
              message: alert.message,
              createdAt: alert.createdAt.toISOString(),
            });
            createdCount++;
          }
        }
      }

      // 3. Hàng cận hạn sử dụng (trong 30 ngày tới)
      if (item.earliestExp && item.earliestExp <= thirtyDaysLater) {
        const key = `${AlertType.EXPIRING_SOON}:${bStr}:${pStr}`;
        if (!openAlertKeys.has(key)) {
          const alert = await prisma.aiAlert.create({
            data: {
              alertType: AlertType.EXPIRING_SOON,
              severity: AlertSeverity.HIGH,
              branchId: item.branchId,
              productId: item.productId,
              title: `[PB19] Cảnh báo hàng cận hạn sử dụng: ${item.sku}`,
              message: `Lô hàng tại ${item.branchName} sắp hết hạn vào ${item.earliestExp.toLocaleDateString('vi-VN')}. Đề xuất ưu tiên xuất FEFO hoặc chạy khuyến mãi.`,
            },
          });

          openAlertKeys.add(key);
          emitAlertCreated({
            id: alert.id.toString(),
            alertType: alert.alertType,
            severity: alert.severity,
            colorLevel: mapSeverityColor(alert.severity),
            branchId: alert.branchId?.toString() ?? null,
            title: alert.title,
            message: alert.message,
            createdAt: alert.createdAt.toISOString(),
          });
          createdCount++;
        }
      }
    }
  } catch (err: unknown) {
    logger.warn('PB19 Stock Alert Scan skipped/failed (DB may be offline)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return createdCount;
}

/**
 * PB12: Quét định kỳ kiểm tra các đơn hàng quá hạn SLA 2 giờ chưa đóng gói
 */
export async function runOrderSlaScan(): Promise<number> {
  let createdCount = 0;
  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const overdueOrders = await prisma.customerOrder.findMany({
      where: {
        status: { in: [OrderStatus.ALLOCATED, OrderStatus.PACKING] },
        OR: [
          { slaDeadline: { lt: now } },
          { slaDeadline: null, createdAt: { lt: twoHoursAgo } },
        ],
      },
      include: {
        assignedBranch: { select: { id: true, name: true } },
      },
    });

    for (const order of overdueOrders) {
      const existing = await prisma.aiAlert.findFirst({
        where: {
          alertType: AlertType.SLA_BREACH,
          orderId: order.id,
          isResolved: false,
        },
      });

      if (!existing) {
        const alert = await prisma.aiAlert.create({
          data: {
            alertType: AlertType.SLA_BREACH,
            severity: AlertSeverity.CRITICAL,
            branchId: order.assignedBranchId,
            orderId: order.id,
            title: `[PB12] Đơn hàng ${order.code} quá hạn SLA 2 giờ`,
            message: `Đơn hàng của ${order.customerName} tại ${order.assignedBranch?.name || 'Kho'} đang ở trạng thái ${order.status} quá thời hạn SLA đóng gói.`,
            payload: {
              code: 'PB12_ORDER_SLA_BREACH',
              orderCode: order.code,
              status: order.status,
            },
          },
        });

        emitAlertCreated({
          id: alert.id.toString(),
          alertType: alert.alertType,
          severity: alert.severity,
          colorLevel: 'RED',
          branchId: alert.branchId?.toString() ?? null,
          title: alert.title,
          message: alert.message,
          createdAt: alert.createdAt.toISOString(),
        });
        createdCount++;
      }
    }
  } catch (err: unknown) {
    logger.warn('PB12 Order SLA Scan skipped/failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return createdCount;
}

/**
 * PB14: Quét định kỳ phát hiện xe điều chuyển trễ lịch trình ETA quá 30 phút
 */
export async function runTransferEtaScan(): Promise<number> {
  let createdCount = 0;
  try {
    const threshold = new Date(Date.now() - 30 * 60 * 1000);

    const delayedTransfers = await prisma.transferTicket.findMany({
      where: {
        status: TransferStatus.IN_TRANSIT,
        eta: { lt: threshold },
      },
      include: {
        sourceBranch: { select: { code: true } },
        destBranch: { select: { id: true, code: true, name: true } },
      },
    });

    for (const trf of delayedTransfers) {
      const existing = await prisma.aiAlert.findFirst({
        where: {
          alertType: AlertType.SLA_BREACH,
          transferTicketId: trf.id,
          isResolved: false,
        },
      });

      if (!existing) {
        const alert = await prisma.aiAlert.create({
          data: {
            alertType: AlertType.SLA_BREACH,
            severity: AlertSeverity.HIGH,
            branchId: trf.destBranchId,
            transferTicketId: trf.id,
            title: `[PB14] Chuyến xe ${trf.code} trễ lịch trình ETA > 30 phút`,
            message: `Tuyến ${trf.sourceBranch.code} → ${trf.destBranch.code} (${trf.vehiclePlate || 'Xe nội bộ'}) đã trễ quá 30 phút so với ETA dự kiến.`,
            payload: {
              code: 'PB14_TRANSFER_DELAYED',
              transferCode: trf.code,
              vehiclePlate: trf.vehiclePlate,
            },
          },
        });

        emitAlertCreated({
          id: alert.id.toString(),
          alertType: alert.alertType,
          severity: alert.severity,
          colorLevel: 'RED',
          branchId: alert.branchId?.toString() ?? null,
          title: alert.title,
          message: alert.message,
          createdAt: alert.createdAt.toISOString(),
        });
        createdCount++;
      }
    }
  } catch (err: unknown) {
    logger.warn('PB14 Transfer ETA Scan skipped/failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return createdCount;
}

export async function runAllBackgroundScans(): Promise<ScanSummary> {
  const [pb19Created, pb12Created, pb14Created] = await Promise.all([
    runStockAlertScan(),
    runOrderSlaScan(),
    runTransferEtaScan(),
  ]);
  return {
    pb19Created,
    pb12Created,
    pb14Created,
    scannedAt: new Date().toISOString(),
  };
}

export class BackgroundScheduler {
  private tasks: ScheduledTask[] = [];

  start(): void {
    // PB19: Quét tồn kho & cảnh báo thiếu/ứ đọng mỗi 5 phút
    this.tasks.push(
      cron.schedule('*/5 * * * *', () => {
        runStockAlertScan().then((count) => {
          if (count > 0) logger.info(`Cron PB19 generated ${count} new stock alerts`);
        });
      })
    );

    // PB12: Quét đơn hàng quá hạn SLA 2 giờ mỗi 1 phút
    this.tasks.push(
      cron.schedule('* * * * *', () => {
        runOrderSlaScan().then((count) => {
          if (count > 0) logger.info(`Cron PB12 generated ${count} new order SLA alerts`);
        });
      })
    );

    // PB14: Quét chuyến xe điều chuyển trễ ETA > 30 phút mỗi 2 phút
    this.tasks.push(
      cron.schedule('*/2 * * * *', () => {
        runTransferEtaScan().then((count) => {
          if (count > 0) logger.info(`Cron PB14 generated ${count} new transfer delay alerts`);
        });
      })
    );

    logger.info('Background Scheduler (node-cron) started with 3 active jobs: PB19, PB12, PB14');
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    logger.info('Background Scheduler stopped');
  }
}

export const scheduler = new BackgroundScheduler();
