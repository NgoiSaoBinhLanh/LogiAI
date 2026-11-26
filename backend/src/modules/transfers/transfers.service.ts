import {
  AlertSeverity,
  AlertType,
  AuditActionType,
  Prisma,
  TransferStatus,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { emitApprovalNotification, emitFleetGpsUpdated } from '../../sockets/socket.server';
import { recordAuditLog } from '../../utils/audit';
import {
  ApproveTransferInput,
  CreateTransferInput,
  ListTransfersQuery,
  ReceiveTransferInput,
  UpdateTransferGpsInput,
} from './transfers.schema';

export class TransferDomainError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class TransfersService {
  async list(query: ListTransfersQuery, userBranchId: bigint | null, isAdmin: boolean) {
    const where: Prisma.TransferTicketWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.sourceBranchId) where.sourceBranchId = BigInt(query.sourceBranchId);
    if (query.destBranchId) where.destBranchId = BigInt(query.destBranchId);

    if (!isAdmin && userBranchId && !query.sourceBranchId && !query.destBranchId) {
      where.OR = [{ sourceBranchId: userBranchId }, { destBranchId: userBranchId }];
    }

    const skip = (query.page - 1) * query.limit;
    const [total, items] = await prisma.$transaction([
      prisma.transferTicket.count({ where }),
      prisma.transferTicket.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceBranch: {
            select: { id: true, code: true, name: true, latitude: true, longitude: true },
          },
          destBranch: {
            select: { id: true, code: true, name: true, latitude: true, longitude: true },
          },
          creator: { select: { id: true, fullName: true } },
          approver: { select: { id: true, fullName: true } },
          details: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  barcode: true,
                  name: true,
                  unit: true,
                  minStock: true,
                  weight: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Kèm tồn khả dụng tại kho nguồn cho màn hình Duyệt lệnh chuyển kho (UI08)
    const enriched = await Promise.all(
      items.map(async (t) => {
        const sourceStocks = await prisma.stock.groupBy({
          by: ['productId'],
          where: {
            branchId: t.sourceBranchId,
            productId: { in: t.details.map((d) => d.productId) },
          },
          _sum: { qtyOnHand: true, qtyReserved: true },
        });

        const availMap = new Map<string, number>();
        for (const s of sourceStocks) {
          availMap.set(
            s.productId.toString(),
            (s._sum.qtyOnHand ?? 0) - (s._sum.qtyReserved ?? 0)
          );
        }

        return {
          ...t,
          temperatureC: t.temperatureC ? Number(t.temperatureC) : null,
          currentLat: t.currentLat ? Number(t.currentLat) : null,
          currentLng: t.currentLng ? Number(t.currentLng) : null,
          aiConfidence: t.aiConfidence ? Number(t.aiConfidence) : null,
          sourceBranch: {
            ...t.sourceBranch,
            latitude: Number(t.sourceBranch.latitude),
            longitude: Number(t.sourceBranch.longitude),
          },
          destBranch: {
            ...t.destBranch,
            latitude: Number(t.destBranch.latitude),
            longitude: Number(t.destBranch.longitude),
          },
          details: t.details.map((d) => ({
            ...d,
            sourceAvailable: availMap.get(d.productId.toString()) ?? 0,
            product: {
              ...d.product,
              weight: d.product.weight ? Number(d.product.weight) : null,
            },
          })),
        };
      })
    );

    return {
      items: enriched,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(input: CreateTransferInput, actorId: bigint, ipAddress: string | null) {
    const sourceBranchId = BigInt(input.sourceBranchId);
    const destBranchId = BigInt(input.destBranchId);

    if (sourceBranchId === destBranchId) {
      throw new TransferDomainError(
        'SAME_BRANCH',
        'Kho xuất và kho nhập không được trùng nhau',
        400
      );
    }

    const code = `TRF-${Date.now().toString().slice(-8)}`;
    const now = new Date();
    const eta = new Date(now.getTime() + input.etaHours * 60 * 60 * 1000);
    const slaDeadline = new Date(eta.getTime() + 2 * 60 * 60 * 1000);

    const created = await prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        const productId = BigInt(item.productId);
        const stocks = await tx.stock.findMany({
          where: { branchId: sourceBranchId, productId, isLocked: false },
          orderBy: [{ expDate: 'asc' }, { id: 'asc' }],
          include: { product: { select: { sku: true } } },
        });

        const totalAvail = stocks.reduce(
          (acc, s) => acc + Math.max(0, s.qtyOnHand - s.qtyReserved),
          0
        );

        if (totalAvail < item.qtyRequested) {
          const skuLabel = stocks[0]?.product.sku || item.productId;
          throw new TransferDomainError(
            'INSUFFICIENT_SOURCE_STOCK',
            `Kho nguồn không đủ tồn khả dụng cho mã hàng ${skuLabel} (Khả dụng: ${totalAvail})`,
            400
          );
        }

        // Giữ chỗ (Reserve) tồn kho tại kho nguồn (PB13)
        let remaining = item.qtyRequested;
        for (const s of stocks) {
          if (remaining <= 0) break;
          const avail = Math.max(0, s.qtyOnHand - s.qtyReserved);
          if (avail <= 0) continue;
          const take = Math.min(avail, remaining);
          await tx.stock.update({
            where: { id: s.id },
            data: { qtyReserved: { increment: take } },
          });
          remaining -= take;
        }
      }

      return tx.transferTicket.create({
        data: {
          code,
          sourceBranchId,
          destBranchId,
          status: TransferStatus.PENDING,
          createdBy: actorId,
          transportMethod: input.transportMethod ?? 'Xe tải nội bộ',
          driverName: input.driverName ?? null,
          driverPhone: input.driverPhone ?? null,
          vehiclePlate: input.vehiclePlate ?? null,
          eta,
          slaDeadline,
          aiSuggested: input.aiSuggested,
          aiConfidence: input.aiConfidence ?? null,
          details: {
            create: input.items.map((i) => ({
              productId: BigInt(i.productId),
              qtyRequested: i.qtyRequested,
              qtyReceived: 0,
            })),
          },
        },
        include: { details: true },
      });
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'TRANSFER',
      newData: { id: created.id.toString(), code: created.code },
      ipAddress,
    });

    return created;
  }

  async approve(
    transferId: bigint,
    input: ApproveTransferInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const ticket = await prisma.transferTicket.findUnique({
      where: { id: transferId },
      include: { details: true },
    });
    if (!ticket) {
      throw new TransferDomainError('TRANSFER_NOT_FOUND', 'Không tìm thấy lệnh điều chuyển', 404);
    }
    if (ticket.status !== TransferStatus.PENDING) {
      throw new TransferDomainError('INVALID_STATUS', 'Chỉ phê duyệt được lệnh đang Chờ duyệt', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.adjustedItems && input.adjustedItems.length > 0) {
        for (const adj of input.adjustedItems) {
          const detail = ticket.details.find((d) => d.id.toString() === adj.detailId);
          if (!detail) continue;

          if (adj.qtyRequested > detail.qtyRequested) {
            throw new TransferDomainError(
              'CANNOT_EXCEED_REQUEST',
              'Quản lý chi nhánh chỉ được giữ nguyên hoặc giảm số lượng xuất điều chuyển',
              400
            );
          }

          const diffToRelease = detail.qtyRequested - adj.qtyRequested;
          if (diffToRelease > 0) {
            const reservedStocks = await tx.stock.findMany({
              where: {
                branchId: ticket.sourceBranchId,
                productId: detail.productId,
                qtyReserved: { gt: 0 },
              },
            });
            let releaseRem = diffToRelease;
            for (const rs of reservedStocks) {
              if (releaseRem <= 0) break;
              const release = Math.min(rs.qtyReserved, releaseRem);
              await tx.stock.update({
                where: { id: rs.id },
                data: { qtyReserved: { decrement: release } },
              });
              releaseRem -= release;
            }
            await tx.transferTicketDetail.update({
              where: { id: detail.id },
              data: { qtyRequested: adj.qtyRequested },
            });
          }
        }
      }

      return tx.transferTicket.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.APPROVED,
          approvedBy: actorId,
        },
      });
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.APPROVE,
      module: 'TRANSFER',
      oldData: { status: ticket.status },
      newData: { status: updated.status, code: ticket.code },
      ipAddress,
    });

    emitApprovalNotification({
      type: 'TRANSFER',
      code: ticket.code,
      action: 'APPROVED',
      branchId: ticket.sourceBranchId.toString(),
      message: `Lệnh điều chuyển ${ticket.code} đã được ký duyệt xuất kho`,
    });

    return updated;
  }

  async reject(transferId: bigint, actorId: bigint, ipAddress: string | null) {
    const ticket = await prisma.transferTicket.findUnique({
      where: { id: transferId },
      include: { details: true },
    });
    if (!ticket) {
      throw new TransferDomainError('TRANSFER_NOT_FOUND', 'Không tìm thấy lệnh điều chuyển', 404);
    }
    if (ticket.status !== TransferStatus.PENDING) {
      throw new TransferDomainError('INVALID_STATUS', 'Chỉ từ chối lệnh đang Chờ duyệt', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const detail of ticket.details) {
        let releaseRem = detail.qtyRequested;
        const stocks = await tx.stock.findMany({
          where: {
            branchId: ticket.sourceBranchId,
            productId: detail.productId,
            qtyReserved: { gt: 0 },
          },
        });
        for (const s of stocks) {
          if (releaseRem <= 0) break;
          const dec = Math.min(s.qtyReserved, releaseRem);
          await tx.stock.update({
            where: { id: s.id },
            data: { qtyReserved: { decrement: dec } },
          });
          releaseRem -= dec;
        }
      }

      return tx.transferTicket.update({
        where: { id: transferId },
        data: { status: TransferStatus.CANCELLED, approvedBy: actorId },
      });
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.REJECT,
      module: 'TRANSFER',
      newData: { code: ticket.code, status: 'CANCELLED' },
      ipAddress,
    });

    emitApprovalNotification({
      type: 'TRANSFER',
      code: ticket.code,
      action: 'REJECTED',
      branchId: ticket.sourceBranchId.toString(),
      message: `Lệnh điều chuyển ${ticket.code} đã bị từ chối`,
    });

    return updated;
  }

  async dispatch(transferId: bigint, actorId: bigint, ipAddress: string | null) {
    const ticket = await prisma.transferTicket.findUnique({
      where: { id: transferId },
      include: { sourceBranch: true },
    });
    if (!ticket) {
      throw new TransferDomainError('TRANSFER_NOT_FOUND', 'Không tìm thấy lệnh điều chuyển', 404);
    }
    if (ticket.status !== TransferStatus.APPROVED) {
      throw new TransferDomainError('INVALID_STATUS', 'Lệnh phải được duyệt trước khi xuất xe', 400);
    }

    const updated = await prisma.transferTicket.update({
      where: { id: transferId },
      data: {
        status: TransferStatus.IN_TRANSIT,
        dispatchedAt: new Date(),
        currentLat: ticket.sourceBranch.latitude,
        currentLng: ticket.sourceBranch.longitude,
      },
    });

    await prisma.transferTrackingLog.create({
      data: {
        transferTicketId: ticket.id,
        latitude: ticket.sourceBranch.latitude,
        longitude: ticket.sourceBranch.longitude,
        speedKmh: 0,
        note: `Xuất phát từ ${ticket.sourceBranch.name}`,
      },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'TRANSFER_DISPATCH',
      newData: { code: ticket.code, status: 'IN_TRANSIT' },
      ipAddress,
    });

    emitApprovalNotification({
      type: 'TRANSFER',
      code: ticket.code,
      action: 'DISPATCHED',
      branchId: ticket.destBranchId.toString(),
      message: `Chuyến xe điều chuyển ${ticket.code} đã xuất bến hướng về kho đích`,
    });

    return updated;
  }

  async receive(
    transferId: bigint,
    input: ReceiveTransferInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const ticket = await prisma.transferTicket.findUnique({
      where: { id: transferId },
      include: { details: { include: { product: { select: { sku: true, name: true } } } } },
    });
    if (!ticket) {
      throw new TransferDomainError('TRANSFER_NOT_FOUND', 'Không tìm thấy lệnh điều chuyển', 404);
    }
    if (ticket.status !== TransferStatus.IN_TRANSIT) {
      throw new TransferDomainError(
        'INVALID_STATUS',
        'Phiếu điều chuyển phải đang ở trạng thái Đang vận chuyển mới được tiếp nhận',
        400
      );
    }

    const targetBinId = BigInt(input.targetBinId);
    let hasDiscrepancy = false;

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        const detail = ticket.details.find((d) => d.id.toString() === item.detailId);
        if (!detail) continue;

        if (item.qtyReceived !== detail.qtyRequested) {
          hasDiscrepancy = true;
        }

        // Trừ tồn thực tế & giải phóng giữ chỗ ở kho nguồn
        let srcRem = detail.qtyRequested;
        const srcStocks = await tx.stock.findMany({
          where: {
            branchId: ticket.sourceBranchId,
            productId: detail.productId,
            qtyOnHand: { gt: 0 },
          },
          orderBy: { id: 'asc' },
        });

        for (const s of srcStocks) {
          if (srcRem <= 0) break;
          const decOnHand = Math.min(s.qtyOnHand, srcRem);
          const decRes = Math.min(s.qtyReserved, decOnHand);
          await tx.stock.update({
            where: { id: s.id },
            data: {
              qtyOnHand: { decrement: decOnHand },
              qtyReserved: { decrement: decRes },
            },
          });
          srcRem -= decOnHand;
        }

        // Cộng tồn kho thực nhận ở kho đích
        if (item.qtyReceived > 0) {
          await tx.stock.upsert({
            where: {
              branchId_productId_binId_batchNo: {
                branchId: ticket.destBranchId,
                productId: detail.productId,
                binId: targetBinId,
                batchNo: `TRF-${ticket.code}`,
              },
            },
            update: { qtyOnHand: { increment: item.qtyReceived } },
            create: {
              branchId: ticket.destBranchId,
              productId: detail.productId,
              binId: targetBinId,
              batchNo: `TRF-${ticket.code}`,
              qtyOnHand: item.qtyReceived,
              qtyReserved: 0,
            },
          });
        }

        await tx.transferTicketDetail.update({
          where: { id: detail.id },
          data: {
            qtyReceived: item.qtyReceived,
            discrepancyReason: item.discrepancyReason ?? null,
          },
        });
      }

      const finalStatus = hasDiscrepancy ? TransferStatus.DISCREPANCY : TransferStatus.RECEIVED;
      const result = await tx.transferTicket.update({
        where: { id: transferId },
        data: {
          status: finalStatus,
          receivedAt: new Date(),
        },
      });

      if (hasDiscrepancy) {
        await tx.aiAlert.create({
          data: {
            alertType: AlertType.SLA_BREACH,
            severity: AlertSeverity.HIGH,
            branchId: ticket.destBranchId,
            transferTicketId: ticket.id,
            title: `Sai lệch tiếp nhận điều chuyển ${ticket.code}`,
            message: 'Số lượng thực nhận tại kho đích khác với số lượng xuất từ kho nguồn.',
          },
        });
      }

      return result;
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'TRANSFER_RECEIVE',
      newData: { code: ticket.code, status: updated.status, hasDiscrepancy },
      ipAddress,
    });

    return updated;
  }

  async listLiveFleet() {
    const now = Date.now();
    const thresholdMs = 30 * 60 * 1000;

    const transfers = await prisma.transferTicket.findMany({
      where: {
        status: {
          in: [TransferStatus.IN_TRANSIT, TransferStatus.APPROVED, TransferStatus.PENDING],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sourceBranch: {
          select: { id: true, code: true, name: true, latitude: true, longitude: true },
        },
        destBranch: {
          select: { id: true, code: true, name: true, latitude: true, longitude: true },
        },
        details: {
          include: { product: { select: { sku: true, name: true, unit: true } } },
        },
        trackingLogs: {
          orderBy: { recordedAt: 'asc' },
        },
      },
    });

    return transfers.map((t) => {
      const isDelayed =
        t.status === TransferStatus.IN_TRANSIT &&
        t.eta !== null &&
        t.eta.getTime() < now - thresholdMs;

      const lastLog = t.trackingLogs[t.trackingLogs.length - 1];
      const currentLat = t.currentLat
        ? Number(t.currentLat)
        : lastLog
        ? Number(lastLog.latitude)
        : Number(t.sourceBranch.latitude);
      const currentLng = t.currentLng
        ? Number(t.currentLng)
        : lastLog
        ? Number(lastLog.longitude)
        : Number(t.sourceBranch.longitude);

      return {
        id: t.id.toString(),
        code: t.code,
        status: t.status,
        transportMethod: t.transportMethod,
        driverName: t.driverName,
        driverPhone: t.driverPhone,
        vehiclePlate: t.vehiclePlate,
        temperatureC: t.temperatureC ? Number(t.temperatureC) : null,
        eta: t.eta,
        dispatchedAt: t.dispatchedAt,
        isDelayed,
        currentLat,
        currentLng,
        speedKmh: lastLog?.speedKmh ? Number(lastLog.speedKmh) : 0,
        sourceBranch: {
          ...t.sourceBranch,
          id: t.sourceBranch.id.toString(),
          latitude: Number(t.sourceBranch.latitude),
          longitude: Number(t.sourceBranch.longitude),
        },
        destBranch: {
          ...t.destBranch,
          id: t.destBranch.id.toString(),
          latitude: Number(t.destBranch.latitude),
          longitude: Number(t.destBranch.longitude),
        },
        details: t.details,
        trackingLogs: t.trackingLogs.map((l) => ({
          id: l.id.toString(),
          latitude: Number(l.latitude),
          longitude: Number(l.longitude),
          speedKmh: l.speedKmh ? Number(l.speedKmh) : 0,
          note: l.note,
          recordedAt: l.recordedAt,
        })),
      };
    });
  }

  async updateGps(transferId: bigint, input: UpdateTransferGpsInput) {
    const ticket = await prisma.transferTicket.findUnique({ where: { id: transferId } });
    if (!ticket) {
      throw new TransferDomainError('TRANSFER_NOT_FOUND', 'Không tìm thấy chuyến xe', 404);
    }

    const log = await prisma.$transaction(async (tx) => {
      await tx.transferTicket.update({
        where: { id: transferId },
        data: {
          currentLat: input.latitude,
          currentLng: input.longitude,
          ...(input.temperatureC !== undefined ? { temperatureC: input.temperatureC } : {}),
        },
      });

      return tx.transferTrackingLog.create({
        data: {
          transferTicketId: transferId,
          latitude: input.latitude,
          longitude: input.longitude,
          speedKmh: input.speedKmh,
          note: input.note ?? 'Cập nhật tọa độ GPS trực tuyến',
        },
      });
    });

    emitFleetGpsUpdated({
      transferId: ticket.id.toString(),
      code: ticket.code,
      latitude: input.latitude,
      longitude: input.longitude,
      speedKmh: input.speedKmh,
      recordedAt: log.recordedAt.toISOString(),
    });

    return log;
  }
}

export const transfersService = new TransfersService();
