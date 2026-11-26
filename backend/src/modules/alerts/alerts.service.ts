import { AlertSeverity, AlertType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { runAllBackgroundScans } from '../../jobs/scheduler';
import { emitAlertResolved } from '../../sockets/socket.server';

export interface ListAlertsFilter {
  isResolved?: boolean;
  severity?: AlertSeverity;
  alertType?: AlertType;
  branchId?: string;
  limit?: number;
}

export class AlertsService {
  async list(filter: ListAlertsFilter, userBranchId: bigint | null, isAdmin: boolean) {
    const where: Prisma.AiAlertWhereInput = {};
    if (filter.isResolved !== undefined) where.isResolved = filter.isResolved;
    if (filter.severity) where.severity = filter.severity;
    if (filter.alertType) where.alertType = filter.alertType;
    if (filter.branchId) {
      where.branchId = BigInt(filter.branchId);
    } else if (!isAdmin && userBranchId) {
      where.OR = [{ branchId: userBranchId }, { branchId: null }];
    }

    const items = await prisma.aiAlert.findMany({
      where,
      take: filter.limit ?? 50,
      orderBy: [{ isResolved: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
      include: {
        branch: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, sku: true, name: true } },
        transferTicket: { select: { id: true, code: true, status: true } },
        order: { select: { id: true, code: true, status: true } },
      },
    });

    const mapped = items.map((a) => ({
      ...a,
      colorLevel:
        a.severity === AlertSeverity.CRITICAL || a.severity === AlertSeverity.HIGH
          ? ('RED' as const)
          : ('YELLOW' as const),
    }));

    const unresolvedRed = mapped.filter((a) => !a.isResolved && a.colorLevel === 'RED').length;
    const unresolvedYellow = mapped.filter(
      (a) => !a.isResolved && a.colorLevel === 'YELLOW'
    ).length;

    return {
      items: mapped,
      summary: {
        unresolvedRed,
        unresolvedYellow,
        totalUnresolved: unresolvedRed + unresolvedYellow,
      },
    };
  }

  async resolve(alertId: bigint, actorId: bigint) {
    const updated = await prisma.aiAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedBy: actorId,
        resolvedAt: new Date(),
      },
    });

    emitAlertResolved(updated.id.toString());
    return updated;
  }

  async triggerScan() {
    return runAllBackgroundScans();
  }
}

export const alertsService = new AlertsService();
