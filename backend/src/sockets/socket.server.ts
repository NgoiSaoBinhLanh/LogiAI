import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../utils/jwt';
import { loadLiveRbacProfile } from '../middlewares/auth.middleware';

let ioInstance: SocketIOServer | null = null;

export function setupWebSocket(server: HttpServer | HttpsServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      (socket.handshake.headers.authorization?.replace('Bearer ', '') ?? undefined);

    if (!token) {
      next();
      return;
    }

    try {
      const decoded = verifyAccessToken(token);
      const profile = await loadLiveRbacProfile(BigInt(decoded.sub));
      if (profile && profile.status === 'ACTIVE') {
        socket.data.user = profile;
      }
      next();
    } catch {
      next(new Error('UNAUTHORIZED_SOCKET'));
    }
  });

  io.on('connection', (socket) => {
    const profile = socket.data.user as
      | { userId: string; branchId: string | null; roles: string[] }
      | undefined;

    if (profile) {
      socket.join(`user:${profile.userId}`);
      if (profile.branchId) {
        socket.join(`branch:${profile.branchId}`);
      }
      for (const role of profile.roles) {
        socket.join(`role:${role}`);
      }
      logger.info(`Authenticated WebSocket connected: ${socket.id} (user: ${profile.userId})`);
    } else {
      logger.info(`WebSocket client connected: ${socket.id}`);
    }

    socket.emit('connected', {
      message: 'Connected to LOGAI WebSocket server',
      timestamp: new Date().toISOString(),
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function emitRbacUpdate(userIds: Array<bigint | string>, roleCode?: string): void {
  if (!ioInstance) return;
  const payload = { roleCode, updatedAt: new Date().toISOString() };
  for (const uid of userIds) {
    ioInstance.to(`user:${uid.toString()}`).emit('rbac:updated', payload);
  }
  if (roleCode) {
    ioInstance.to(`role:${roleCode}`).emit('rbac:updated', payload);
  }
}

export interface AlertRealtimePayload {
  id: string;
  alertType: string;
  severity: string;
  colorLevel: 'RED' | 'YELLOW';
  branchId: string | null;
  title: string;
  message: string;
  createdAt: string;
}

export function emitAlertCreated(alert: AlertRealtimePayload): void {
  if (!ioInstance) return;
  ioInstance.emit('alert:new', alert);
}

export function emitAlertResolved(alertId: string): void {
  if (!ioInstance) return;
  ioInstance.emit('alert:resolved', { id: alertId, resolvedAt: new Date().toISOString() });
}

export function emitOrderUpdated(order: {
  id: string;
  code: string;
  status: string;
  assignedBranchId: string | null;
  pickingProgress: number;
  trackingNumber: string | null;
}): void {
  if (!ioInstance) return;
  ioInstance.emit('order:updated', {
    ...order,
    updatedAt: new Date().toISOString(),
  });
}

export function emitApprovalNotification(payload: {
  type: 'STOCK_CHECK' | 'TRANSFER';
  code: string;
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DISPATCHED';
  branchId?: string | null;
  message: string;
}): void {
  if (!ioInstance) return;
  ioInstance.emit('approval:notification', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function emitFleetGpsUpdated(payload: {
  transferId: string;
  code: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  recordedAt: string;
}): void {
  if (!ioInstance) return;
  ioInstance.emit('fleet:gps', payload);
}
