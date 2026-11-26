'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { BarcodeScannerDialog } from '@/components/barcode/barcode-scanner-dialog';
import { ThermalTicketPrinter } from '@/components/barcode/thermal-ticket-printer';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/services/api';
import { BranchOpsApi, InventoryApi } from '@/services/operations.service';
import { BranchDetailItem, InventoryTicketItem } from '@/types/operations';
import { useAuth } from '@/store/auth-context';

interface PickingCandidate {
  stockId: string;
  product: { id: string; sku: string; barcode: string; name: string; unit: string };
  bin: { id: string; code: string; zone: { code: string; name: string } };
  batchNo: string;
  expDate: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  isLocked: boolean;
}

interface OutboundLine {
  productId: string;
  sku: string;
  name: string;
  binId: string;
  binCode: string;
  batchNo: string;
  maxAvailable: number;
  qty: number;
}

export default function OutboundPickingPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchDetailItem[]>([]);
  const [pickingList, setPickingList] = useState<PickingCandidate[]>([]);
  const [tickets, setTickets] = useState<InventoryTicketItem[]>([]);

  const [branchId, setBranchId] = useState('');
  const [reason, setReason] = useState('Xuất bán lẻ / Đơn hàng đại lý');
  const [lines, setLines] = useState<OutboundLine[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [wedgeScan, setWedgeScan] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'LOCKED'>('ALL');
  const [submitting, setSubmitting] = useState(false);

  const loadBase = useCallback(async () => {
    try {
      const [bRes, tRes] = await Promise.all([
        BranchOpsApi.list(),
        InventoryApi.listTickets({ type: 'EXPORT', limit: 15 }),
      ]);
      setBranches(bRes.branches);
      setTickets(tRes.items);
      const defaultBranch = user?.branchId || bRes.branches[0]?.id || '';
      if (!branchId && defaultBranch) setBranchId(defaultBranch);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải dữ liệu xuất kho');
    }
  }, [user?.branchId, branchId]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  const loadPicking = useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await InventoryApi.pickingList(branchId);
      setPickingList(res.items);
    } catch {
      // ignore
    }
  }, [branchId]);

  useEffect(() => {
    loadPicking();
  }, [loadPicking]);

  const addPickLine = (item: PickingCandidate, qtyToAdd = 1) => {
    if (item.isLocked) {
      toast.error(`Kệ ${item.bin.code} đang bị khóa do kiểm kê!`);
      return;
    }

    setLines((prev) => {
      const idx = prev.findIndex(
        (l) =>
          l.productId === item.product.id &&
          l.binId === item.bin.id &&
          l.batchNo === item.batchNo
      );
      if (idx >= 0) {
        const nextQty = prev[idx].qty + qtyToAdd;
        if (nextQty > item.qtyAvailable) {
          toast.error(`Số lượng vượt tồn khả dụng (${item.qtyAvailable})`);
          return prev;
        }
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: nextQty };
        return copy;
      }

      if (qtyToAdd > item.qtyAvailable) {
        toast.error(`Số lượng vượt tồn khả dụng (${item.qtyAvailable})`);
        return prev;
      }

      return [
        ...prev,
        {
          productId: item.product.id,
          sku: item.product.sku,
          name: item.product.name,
          binId: item.bin.id,
          binCode: item.bin.code,
          batchNo: item.batchNo,
          maxAvailable: item.qtyAvailable,
          qty: qtyToAdd,
        },
      ];
    });
  };

  const handleBarcodeDetected = (code: string) => {
    const match = pickingList.find(
      (i) =>
        i.product.barcode.toLowerCase() === code.toLowerCase() ||
        i.product.sku.toLowerCase() === code.toLowerCase()
    );
    if (!match) {
      toast.error(`Không có tồn khả dụng khớp mã ${code} tại chi nhánh này`);
      return;
    }
    addPickLine(match, 1);
    toast.success(`Đã quét nhặt +1 ${match.product.sku} tại kệ ${match.bin.code} (FEFO)`);
  };

  const handleConfirmOutbound = async () => {
    if (!branchId || lines.length === 0) return;
    setSubmitting(true);
    try {
      await InventoryApi.createTicket({
        type: 'EXPORT',
        branchId,
        reason,
        confirmImmediately: true,
        details: lines.map((l) => ({
          productId: l.productId,
          binId: l.binId,
          batchNo: l.batchNo,
          qty: l.qty,
        })),
      });
      toast.success('Đã xác nhận xuất kho và giảm trừ tồn kho thành công!');
      setLines([]);
      await Promise.all([loadBase(), loadPicking()]);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Xuất kho thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const visiblePicking = pickingList.filter((p) => {
    if (statusFilter === 'AVAILABLE') return !p.isLocked && p.qtyAvailable > 0;
    if (statusFilter === 'LOCKED') return p.isLocked;
    return true;
  });

  const totalPickedQty = lines.reduce((sum, l) => sum + l.qty, 0);
  const pickProgressPct =
    pickingList.length > 0 ? Math.min(100, Math.round((lines.length / pickingList.length) * 100)) : 0;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        {/* Top SLA & Order Hero Strip (XuLyXuatKho.html) */}
        <section className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-mono text-[11px] font-bold">
                FEFO PICKING · PB08
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-[11px] font-bold">
                Chặn xuất quá tồn khả dụng
              </span>
            </div>
            <h1 className="text-headline-lg font-bold text-on-surface">
              PHIẾU XUẤT KHO &amp; NHẶT HÀNG FEFO
            </h1>
            <p className="text-body-sm text-on-surface-variant">
              Ưu tiên xuất lô hết hạn trước (FEFO) · tự động sắp xếp danh sách lấy hàng theo kệ
              Zone &amp; Bin
            </p>
            <div className="pt-1 max-w-sm">
              <Select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setLines([]);
                }}
                disabled={!!user?.branchId && !user.roles.includes('ADMIN')}
                options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
              />
            </div>
          </div>

          {/* Circular Progress Ring (XuLyXuatKho.html) */}
          <div className="flex items-center gap-4 bg-surface-container-low rounded-xl px-5 py-4 shrink-0">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="#dce9ff"
                  strokeWidth="6"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="#1d4ed8"
                  strokeWidth="6"
                  strokeDasharray={`${(pickProgressPct / 100) * 163.36} 163.36`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute font-mono text-xs font-bold text-primary">
                {pickProgressPct}%
              </span>
            </div>
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Đã đưa vào phiếu
              </div>
              <div className="text-headline-sm font-mono font-bold text-on-surface">
                {lines.length} dòng · {totalPickedQty} ĐV
              </div>
            </div>
          </div>
        </section>

        {/* 8 / 4 Scanner Ready & AI Optimal Route Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 flex items-center gap-2.5 bg-surface-container-low rounded-lg px-3.5 h-12">
              <span className="material-symbols-outlined text-primary text-[22px]">
                barcode_scanner
              </span>
              <input
                type="text"
                value={wedgeScan}
                onChange={(e) => setWedgeScan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && wedgeScan.trim()) {
                    e.preventDefault();
                    handleBarcodeDetected(wedgeScan.trim());
                    setWedgeScan('');
                  }
                }}
                placeholder="SCANNER SẴN SÀNG — Quét mã vạch SKU để tự chọn lô FEFO..."
                className="flex-1 bg-transparent font-mono text-xs font-semibold text-on-surface placeholder:text-outline focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="h-12 px-5 rounded-lg bg-primary-container hover:bg-primary text-white text-label-md font-semibold flex items-center justify-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-[19px]">qr_code_scanner</span>
              <span>Quét xác nhận nhặt hàng</span>
            </button>
          </div>

          <div className="lg:col-span-4 bg-primary-fixed/60 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-container text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">route</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Lộ trình AI tối ưu
              </div>
              <div className="text-xs font-semibold text-on-surface mt-0.5">
                {pickingList[0]
                  ? `Bắt đầu từ Zone ${pickingList[0].bin.zone.code} · Kệ ${pickingList[0].bin.code}`
                  : 'Chưa có gợi ý lộ trình'}
              </div>
            </div>
          </div>
        </div>

        {/* Main 7/5 Workspace: FEFO Picking Cards + Current Outbound Slip */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 cols: Zone-Grouped FEFO Picking Cards */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-headline-sm font-bold text-on-surface">
                Danh sách Picking List FEFO ({visiblePicking.length})
              </h2>
              <div className="flex bg-surface-container-low p-1 rounded-lg">
                {(
                  [
                    { id: 'ALL', label: 'Tất cả' },
                    { id: 'AVAILABLE', label: 'Sẵn sàng' },
                    { id: 'LOCKED', label: 'Khóa kiểm kê' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatusFilter(s.id)}
                    className={`px-3 py-1 rounded-md text-label-sm font-semibold ${
                      statusFilter === s.id
                        ? 'bg-surface-container-lowest text-primary shadow-xs'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {visiblePicking.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-xl p-10 text-center text-outline shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                Chưa có hàng tồn khả dụng phù hợp tại chi nhánh này
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visiblePicking.map((item) => (
                  <div
                    key={item.stockId}
                    className={`bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between gap-3 ${
                      item.isLocked ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-sm text-primary">
                          {item.product.sku}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] font-bold text-on-surface">
                            {item.bin.code}
                          </span>
                          {item.isLocked && (
                            <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container text-[10px] font-bold">
                              Khóa kiểm kê
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-xs font-semibold text-on-surface line-clamp-2">
                        {item.product.name}
                      </div>

                      {/* FEFO Purple Lot & Expiry Strip (XuLyXuatKho.html) */}
                      <div className="rounded-lg bg-tertiary-fixed/45 px-3 py-2 text-[11px] text-on-tertiary-fixed flex items-center justify-between">
                        <span className="font-mono font-semibold">Lô: {item.batchNo}</span>
                        <span className="font-semibold">
                          HSD:{' '}
                          {item.expDate
                            ? new Date(item.expDate).toLocaleDateString('vi-VN')
                            : 'Không HSD'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-3 pt-1">
                      <div>
                        <span className="text-[10px] uppercase text-outline font-bold block">
                          Tồn khả dụng
                        </span>
                        <span className="text-headline-md font-mono font-bold text-emerald-700">
                          {item.qtyAvailable}
                        </span>{' '}
                        <span className="text-xs text-outline">{item.product.unit}</span>
                      </div>
                      <button
                        type="button"
                        disabled={item.isLocked}
                        onClick={() => addPickLine(item, 1)}
                        className="h-10 px-4 rounded-lg bg-primary-container hover:bg-primary disabled:opacity-40 text-white text-label-md font-bold transition-colors"
                      >
                        + Nhặt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right 5 cols: Outbound Slip */}
          <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-4">
            <h2 className="text-headline-sm font-bold text-on-surface">Chi tiết Phiếu Xuất Kho</h2>
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={[
                { value: 'Xuất bán lẻ / Đơn hàng đại lý', label: 'Xuất bán lẻ / Đơn hàng đại lý' },
                {
                  value: 'Xuất hủy hàng hỏng / hết hạn',
                  label: 'Xuất hủy hàng hỏng / hết hạn',
                },
                { value: 'Xuất hàng mẫu', label: 'Xuất hàng mẫu' },
              ]}
            />

            <div className="rounded-xl overflow-hidden bg-surface-container-low/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                    <th className="py-2.5 px-3 font-semibold">SKU / Kệ</th>
                    <th className="py-2.5 px-3 font-semibold">SL xuất</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low text-body-sm">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-outline text-xs">
                        Chọn mặt hàng từ Picking List hoặc quét mã vạch
                      </td>
                    </tr>
                  ) : (
                    lines.map((l, idx) => (
                      <tr key={`${l.productId}-${l.binId}-${l.batchNo}`}>
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-bold text-xs text-primary">
                            {l.sku} · Kệ {l.binCode}
                          </div>
                          <div className="text-[11px] text-outline">
                            Lô {l.batchNo} (Tối đa: {l.maxAvailable})
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <Input
                            type="number"
                            min={1}
                            max={l.maxAvailable}
                            value={l.qty}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value || '1', 10));
                              setLines((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, qty: val } : row))
                              );
                            }}
                            className="w-20 h-8 font-mono text-center font-bold"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1 rounded text-error hover:bg-error-container/50"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Outbound Tickets */}
        <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="px-6 py-4 bg-surface-container-low/50">
            <h2 className="text-headline-sm font-bold text-on-surface">
              Phiếu Xuất Kho gần đây ({tickets.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                  <th className="py-3 pl-6 pr-3 font-semibold">Mã phiếu</th>
                  <th className="py-3 px-3 font-semibold">Chi nhánh &amp; Lý do</th>
                  <th className="py-3 px-3 font-semibold">Trạng thái</th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">In phiếu nhiệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-body-sm">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low/50">
                    <td className="py-3 pl-6 pr-3 font-mono font-bold text-primary">{t.code}</td>
                    <td className="py-3 px-3">
                      <p className="text-xs font-semibold text-on-surface">{t.branch.name}</p>
                      <p className="text-[11px] text-outline">{t.reason}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-[11px] font-bold">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right">
                      <ThermalTicketPrinter ticket={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Fixed Sticky Bottom Footer */}
      <div className="fixed bottom-0 left-0 lg:left-[260px] right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="text-body-sm text-on-surface-variant">
          Đã chọn nhặt <strong className="font-mono text-primary">{lines.length}</strong> lô hàng ·{' '}
          <strong className="font-mono text-on-surface">{totalPickedQty}</strong> đơn vị xuất
        </div>
        <button
          type="button"
          onClick={handleConfirmOutbound}
          disabled={submitting || lines.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-container hover:bg-primary disabled:opacity-50 text-white px-6 py-2.5 text-label-md font-bold shadow-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{submitting ? 'Đang xuất kho...' : 'Xác nhận Xuất Kho'}</span>
        </button>
      </div>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcodeDetected}
      />
    </AppShell>
  );
}
