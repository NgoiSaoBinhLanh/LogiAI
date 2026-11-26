'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ApiError } from '@/services/api';
import { BranchOpsApi, OrderApi } from '@/services/operations.service';
import { BranchDetailItem, KanbanOrderItem } from '@/types/operations';
import { useAuth } from '@/store/auth-context';
import { exportToExcel } from '@/lib/export-utils';

type BoardStage = 'ALLOCATED' | 'PACKING' | 'SHIPPED' | 'DELIVERED';

const KANBAN_COLUMNS: Array<{
  id: BoardStage;
  title: string;
  dotColor: string;
  nextStage?: BoardStage;
}> = [
  { id: 'ALLOCATED', title: 'Đã phân bổ', dotColor: 'bg-primary-container', nextStage: 'PACKING' },
  {
    id: 'PACKING',
    title: 'Đang nhặt & Đóng gói',
    dotColor: 'bg-amber-500',
    nextStage: 'SHIPPED',
  },
  {
    id: 'SHIPPED',
    title: 'Bàn giao Vận chuyển (3PL)',
    dotColor: 'bg-indigo-500',
    nextStage: 'DELIVERED',
  },
  { id: 'DELIVERED', title: 'Hoàn tất giao hàng', dotColor: 'bg-[#10B981]' },
];

function OrderCard({
  order,
  onMoveNext,
  isDraggingOverlay = false,
}: {
  order: KanbanOrderItem;
  onMoveNext?: (order: KanbanOrderItem, next: BoardStage) => void;
  isDraggingOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { order },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const colDef = KANBAN_COLUMNS.find((c) => c.id === order.status);
  const isBreached = order.slaStatus === 'BREACHED';

  return (
    <div
      ref={isDraggingOverlay ? undefined : setNodeRef}
      style={isDraggingOverlay ? undefined : style}
      {...(isDraggingOverlay ? {} : attributes)}
      {...(isDraggingOverlay ? {} : listeners)}
      className={`rounded-xl bg-surface-container-lowest p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-3 cursor-grab active:cursor-grabbing transition-all relative overflow-hidden ${
        isBreached
          ? 'ring-2 ring-error/40 bg-[#FEF2F2]/65'
          : order.slaStatus === 'AT_RISK'
            ? 'ring-1 ring-amber-400'
            : ''
      } ${isDragging && !isDraggingOverlay ? 'opacity-40' : 'hover:shadow-md'}`}
    >
      {isBreached && <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-error" />}

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono font-bold text-xs text-primary">{order.code}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-surface-container-low text-[10px] font-bold text-on-surface-variant">
            {order.channel}
          </span>
        </div>

        {isBreached ? (
          <span className="px-2 py-0.5 rounded-full bg-error text-white text-[10px] font-bold flex items-center gap-1 animate-pulse">
            <span className="material-symbols-outlined text-[13px]">warning</span>
            Quá SLA
          </span>
        ) : order.slaStatus === 'AT_RISK' ? (
          <span className="px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] text-[10px] font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">schedule</span>
            Còn {order.slaRemainingMinutes}p
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-[10px] font-bold">
            Đúng hạn
          </span>
        )}
      </div>

      <div className="text-xs">
        <p className="font-bold text-on-surface truncate">{order.customerName}</p>
        <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
          {order.assignedBranch?.code} · {order.details.length} SKU ·{' '}
          <span className="font-mono font-semibold text-on-surface">
            {order.totalAmount.toLocaleString('vi-VN')} đ
          </span>
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-on-surface-variant">
          <span>Tiến độ đóng gói</span>
          <span className="font-mono font-bold text-on-surface">{order.pickingProgress}%</span>
        </div>
        <Progress
          value={order.pickingProgress}
          className="h-1.5"
          indicatorClassName={isBreached ? 'bg-error' : 'bg-primary-container'}
        />
      </div>

      {order.trackingNumber && (
        <div className="rounded-lg bg-surface-container-low px-2.5 py-1.5 text-[11px] text-on-surface-variant flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-primary shrink-0">
            local_shipping
          </span>
          <span className="truncate font-mono font-medium">
            {order.carrierName || '3PL'}: {order.trackingNumber}
          </span>
        </div>
      )}

      {colDef?.nextStage && onMoveNext && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onMoveNext(order, colDef.nextStage!)}
          className="w-full h-8 rounded-lg bg-surface-container-low hover:bg-primary-container hover:text-white text-primary text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
        >
          <span>Chuyển bước kế tiếp</span>
          <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
        </button>
      )}
    </div>
  );
}

function KanbanColumn({
  id,
  title,
  dotColor,
  orders,
  onMoveNext,
}: {
  id: BoardStage;
  title: string;
  dotColor: string;
  orders: KanbanOrderItem[];
  onMoveNext: (order: KanbanOrderItem, next: BoardStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl bg-surface-container min-h-[640px] transition-all overflow-hidden ${
        isOver ? 'ring-2 ring-primary-container bg-primary-fixed/40' : ''
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3.5 bg-surface-container-lowest/80">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <span className="text-sm font-bold text-on-surface">{title}</span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-mono text-xs font-bold">
          {orders.length}
        </span>
      </div>
      <div className="flex-1 space-y-3 p-3 overflow-y-auto max-h-[720px] custom-scrollbar">
        {orders.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-outline-variant/60 text-xs text-outline">
            Kéo đơn hàng vào đây
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} onMoveNext={onMoveNext} />
          ))
        )}
      </div>
    </div>
  );
}

export default function KanbanFulfillmentPage() {
  const { socket } = useAuth();
  const [orders, setOrders] = useState<KanbanOrderItem[]>([]);
  const [branches, setBranches] = useState<BranchDetailItem[]>([]);
  const [branchId, setBranchId] = useState('');
  const [search, setSearch] = useState('');
  const [slaFilter, setSlaFilter] = useState<'ALL' | 'AT_RISK' | 'BREACHED'>('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [activeOrder, setActiveOrder] = useState<KanbanOrderItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const loadBoard = useCallback(async () => {
    try {
      const [bRes, kRes] = await Promise.all([
        BranchOpsApi.list(),
        OrderApi.getBoard(branchId || undefined),
      ]);
      setBranches(bRes.branches);
      setOrders(kRes.items);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải bảng Kanban đơn hàng');
    }
  }, [branchId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Đồng bộ Realtime qua WebSocket khi tab khác hoặc kho cập nhật đơn hàng
  useEffect(() => {
    if (!socket) return;
    const handleOrderUpdated = (payload: { code: string; status: string }) => {
      toast.info(`Đồng bộ Realtime: Đơn ${payload.code} -> ${payload.status}`);
      loadBoard();
    };
    socket.on('order:updated', handleOrderUpdated);
    return () => {
      socket.off('order:updated', handleOrderUpdated);
    };
  }, [socket, loadBoard]);

  const filteredOrders = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        !kw ||
        o.code.toLowerCase().includes(kw) ||
        o.customerName.toLowerCase().includes(kw) ||
        o.details.some((d) => d.product.sku.toLowerCase().includes(kw));
      const matchSla = slaFilter === 'ALL' ? true : o.slaStatus === slaFilter;
      const matchChannel =
        channelFilter === 'ALL' ? true : o.channel.toUpperCase() === channelFilter;
      return matchSearch && matchSla && matchChannel;
    });
  }, [orders, search, slaFilter, channelFilter]);

  const moveOrderStage = async (order: KanbanOrderItem, targetStage: BoardStage) => {
    if (order.status === targetStage) return;

    const prevOrders = orders;
    setOrders((curr) =>
      curr.map((o) => (o.id === order.id ? { ...o, status: targetStage } : o))
    );

    try {
      await OrderApi.updateStage(order.id, { status: targetStage });
      toast.success(`Đã chuyển đơn ${order.code} sang ${targetStage}`);
      await loadBoard();
    } catch (err: unknown) {
      setOrders(prevOrders);
      toast.error(err instanceof ApiError ? err.message : 'Không thể chuyển trạng thái');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const ord = event.active.data.current?.order as KanbanOrderItem | undefined;
    if (ord) setActiveOrder(ord);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrder(null);
    const { active, over } = event;
    if (!over) return;
    const ord = active.data.current?.order as KanbanOrderItem | undefined;
    const targetStage = over.id as BoardStage;
    if (ord && KANBAN_COLUMNS.some((c) => c.id === targetStage)) {
      moveOrderStage(ord, targetStage);
    }
  };

  const slaBreachedCount = orders.filter((o) => o.slaStatus === 'BREACHED').length;

  return (
    <AppShell>
      {/* Top White Control & 6-Card SLA Barometer Header (GiamSatDongGoi.html) */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-2.5 py-0.5 rounded bg-primary-fixed text-primary font-mono text-[11px] font-bold">
              UI13 · PB12 KANBAN
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              Real-time WebSocket Sync
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              exportToExcel(
                'bao-cao-sla-kanban',
                'KanbanSLA',
                filteredOrders.map((o) => ({
                  MaDon: o.code,
                  Kenh: o.channel,
                  KhachHang: o.customerName,
                  Kho: o.assignedBranch?.code || '',
                  TrangThai: o.status,
                  MucSLA: o.slaStatus,
                  MaVanDon: o.trackingNumber || '',
                }))
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface px-3.5 py-2 text-label-md font-semibold transition-colors self-start"
          >
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            <span>Xuất báo cáo SLA (Excel)</span>
          </button>
        </div>

        {/* 6-Card Mini SLA Barometer Ribbon (GiamSatDongGoi.html) */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="rounded-xl bg-surface-container-low p-3">
            <p className="text-label-sm text-outline font-semibold">Tổng đơn</p>
            <p className="text-headline-md font-mono font-bold text-on-surface mt-0.5">
              {orders.length}
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-3">
            <p className="text-label-sm text-primary font-semibold">Đã phân bổ</p>
            <p className="text-headline-md font-mono font-bold text-primary mt-0.5">
              {orders.filter((o) => o.status === 'ALLOCATED').length}
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-3">
            <p className="text-label-sm text-amber-600 font-semibold">Đang nhặt</p>
            <p className="text-headline-md font-mono font-bold text-amber-700 mt-0.5">
              {orders.filter((o) => o.status === 'PACKING').length}
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-3">
            <p className="text-label-sm text-indigo-600 font-semibold">Bàn giao 3PL</p>
            <p className="text-headline-md font-mono font-bold text-indigo-700 mt-0.5">
              {orders.filter((o) => o.status === 'SHIPPED').length}
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-3">
            <p className="text-label-sm text-[#10B981] font-semibold">Hoàn tất</p>
            <p className="text-headline-md font-mono font-bold text-[#10B981] mt-0.5">
              {orders.filter((o) => o.status === 'DELIVERED').length}
            </p>
          </div>
          <div
            className={`rounded-xl p-3 ${
              slaBreachedCount > 0
                ? 'bg-error-container ring-1 ring-error/25'
                : 'bg-surface-container-low'
            }`}
          >
            <p className="text-label-sm text-error font-bold">Trễ SLA (&gt; 2h)</p>
            <p className="text-headline-md font-mono font-bold text-error mt-0.5">
              {slaBreachedCount}
            </p>
          </div>
        </div>

        {/* Search & Omnichannel Filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pt-1">
          <div className="flex flex-1 gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã đơn, khách, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 rounded-lg bg-surface-container-low pl-9 pr-3 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
            <div className="w-52">
              <Select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                placeholder="Tất cả kho/hub"
                options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'ALL', label: 'Tất cả SLA' },
                { id: 'AT_RISK', label: 'Nguy cơ trễ' },
                { id: 'BREACHED', label: 'Quá hạn SLA' },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSlaFilter(c.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  slaFilter === c.id
                    ? 'bg-inverse-surface text-white'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {c.label}
              </button>
            ))}
            {['ALL', 'SHOPEE', 'TIKTOK', 'LAZADA', 'WEBSITE', 'B2B'].map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  channelFilter === ch
                    ? 'bg-primary-container text-white'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {ch === 'ALL' ? 'Mọi kênh' : ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban Board (@dnd-kit) */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              dotColor={col.dotColor}
              orders={filteredOrders.filter((o) => o.status === col.id)}
              onMoveNext={moveOrderStage}
            />
          ))}
        </div>
        <DragOverlay>
          {activeOrder ? <OrderCard order={activeOrder} isDraggingOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </AppShell>
  );
}
