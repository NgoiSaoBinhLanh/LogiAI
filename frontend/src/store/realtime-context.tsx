'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './auth-context';
import { invalidateApiCache } from '../services/api';
import { AlertsApi } from '../services/operations.service';
import { AiAlertItem } from '../types/operations';

interface RealtimeContextValue {
  alerts: AiAlertItem[];
  unresolvedRed: number;
  unresolvedYellow: number;
  connected: boolean;
  refreshAlerts: () => Promise<void>;
  triggerScan: () => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user, socket, hasAnyPermission } = useAuth();
  const [alerts, setAlerts] = useState<AiAlertItem[]>([]);
  const [unresolvedRed, setUnresolvedRed] = useState(0);
  const [unresolvedYellow, setUnresolvedYellow] = useState(0);
  const [connected, setConnected] = useState(false);

  const canReadAlerts =
    !!user && hasAnyPermission(['ALERT_MANAGE', 'STOCK_READ', 'ORDER_READ', 'TRANSFER_TRACK']);

  const refreshAlerts = useCallback(async () => {
    if (!canReadAlerts) return;
    try {
      const res = await AlertsApi.list({ isResolved: false, limit: 30 });
      setAlerts(res.items);
      setUnresolvedRed(res.summary.unresolvedRed);
      setUnresolvedYellow(res.summary.unresolvedYellow);
    } catch {
      // Ignore if backend offline
    }
  }, [canReadAlerts]);

  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts]);

  useEffect(() => {
    if (!socket) {
      setConnected(false);
      return;
    }

    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onNewAlert = (incoming: {
      id: string;
      title: string;
      message: string;
      colorLevel: 'RED' | 'YELLOW';
    }) => {
      if (incoming.colorLevel === 'RED') {
        toast.error(incoming.title, { description: incoming.message });
      } else {
        toast.warning(incoming.title, { description: incoming.message });
      }
      invalidateApiCache();
      refreshAlerts();
    };

    const onAlertResolved = () => {
      invalidateApiCache();
      refreshAlerts();
    };

    const onApprovalNote = (payload: { message: string }) => {
      toast.info('Thông báo phê duyệt Realtime', { description: payload.message });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('alert:new', onNewAlert);
    socket.on('alert:resolved', onAlertResolved);
    socket.on('approval:notification', onApprovalNote);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('alert:new', onNewAlert);
      socket.off('alert:resolved', onAlertResolved);
      socket.off('approval:notification', onApprovalNote);
    };
  }, [socket, refreshAlerts]);

  const triggerScan = useCallback(async () => {
    const res = await AlertsApi.scanNow();
    const total =
      res.summary.pb19Created + res.summary.pb12Created + res.summary.pb14Created;
    toast.success(
      `Đã chạy quét PB19/PB12/PB14: Phát hiện ${total} cảnh báo mới.`
    );
    await refreshAlerts();
  }, [refreshAlerts]);

  const resolveAlert = useCallback(
    async (id: string) => {
      await AlertsApi.resolve(id);
      toast.success('Đã đánh dấu xử lý cảnh báo');
      await refreshAlerts();
    },
    [refreshAlerts]
  );

  return (
    <RealtimeContext.Provider
      value={{
        alerts,
        unresolvedRed,
        unresolvedYellow,
        connected,
        refreshAlerts,
        triggerScan,
        resolveAlert,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}
