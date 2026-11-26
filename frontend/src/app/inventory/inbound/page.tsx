'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { BarcodeScannerDialog } from '@/components/barcode/barcode-scanner-dialog';
import { ThermalTicketPrinter } from '@/components/barcode/thermal-ticket-printer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/services/api';
import { BranchOpsApi, InventoryApi, ProductApi } from '@/services/operations.service';
import {
  BranchDetailItem,
  InventoryTicketItem,
  ProductItem,
  SuggestedBinItem,
} from '@/types/operations';
import { useAuth } from '@/store/auth-context';

interface InboundLine {
  productId: string;
  sku: string;
  name: string;
  binId: string;
  batchNo: string;
  expDate: string;
  qty: number;
}

export default function InboundReceivingPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchDetailItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [suggestedBins, setSuggestedBins] = useState<SuggestedBinItem[]>([]);
  const [tickets, setTickets] = useState<InventoryTicketItem[]>([]);

  const [branchId, setBranchId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [reason, setReason] = useState('Nhập hàng từ Nhà cung cấp');
  const [lines, setLines] = useState<InboundLine[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [wedgeScan, setWedgeScan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick add line
  const [selProductId, setSelProductId] = useState('');
  const [selBinId, setSelBinId] = useState('');
  const [batchNo, setBatchNo] = useState(
    `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  );
  const [expDate, setExpDate] = useState('');
  const [qty, setQty] = useState('10');

  const loadData = useCallback(async () => {
    try {
      const [bRes, pRes, tRes] = await Promise.all([
        BranchOpsApi.list(),
        ProductApi.list({ limit: 100 }),
        InventoryApi.listTickets({ type: 'IMPORT', limit: 15 }),
      ]);
      setBranches(bRes.branches);
      setProducts(pRes.items);
      setTickets(tRes.items);

      const defaultBranch = user?.branchId || bRes.branches[0]?.id || '';
      if (!branchId && defaultBranch) setBranchId(defaultBranch);
      if (pRes.items.length > 0 && !selProductId) setSelProductId(pRes.items[0].id);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải dữ liệu nhập kho');
    }
  }, [user?.branchId, branchId, selProductId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!branchId) return;
    InventoryApi.suggestBins(branchId)
      .then((res) => {
        setSuggestedBins(res.bins);
        if (res.bins.length > 0) setSelBinId(res.bins[0].id);
      })
      .catch(() => {});
  }, [branchId]);

  const addProductLine = (prod: ProductItem, addQty = 1) => {
    const targetBin = selBinId || suggestedBins[0]?.id || '';
    if (!targetBin) {
      toast.error('Chi nhánh chưa có kệ Bin hoạt động để xếp hàng');
      return;
    }

    setLines((prev) => {
      const idx = prev.findIndex(
        (l) => l.productId === prod.id && l.binId === targetBin && l.batchNo === batchNo
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + addQty };
        return copy;
      }
      return [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          binId: targetBin,
          batchNo,
          expDate,
          qty: addQty,
        },
      ];
    });
  };

  const handleBarcodeDetected = (code: string) => {
    const found = products.find(
      (p) =>
        p.barcode.toLowerCase() === code.toLowerCase() ||
        p.sku.toLowerCase() === code.toLowerCase()
    );
    if (!found) {
      toast.error(`Không tìm thấy sản phẩm có mã SKU/Barcode: ${code}`);
      return;
    }
    addProductLine(found, 1);
    toast.success(`Đã quét nhận +1 ${found.sku} (${found.name})`);
  };

  const handleConfirmInbound = async () => {
    if (!branchId || lines.length === 0) {
      toast.error('Vui lòng chọn chi nhánh và thêm ít nhất 1 mặt hàng');
      return;
    }
    setSubmitting(true);
    try {
      await InventoryApi.createTicket({
        type: 'IMPORT',
        branchId,
        supplierName: supplierName || 'Nhà cung cấp nội địa',
        reason,
        confirmImmediately: true,
        details: lines.map((l) => ({
          productId: l.productId,
          binId: l.binId,
          batchNo: l.batchNo,
          expDate: l.expDate || null,
          qty: l.qty,
        })),
      });
      toast.success('Đã xác nhận phiếu nhập kho và cập nhật tăng tồn kho thành công!');
      setLines([]);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Xác nhận nhập kho thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const totalUnits = lines.reduce((sum, l) => sum + l.qty, 0);
  const activeBranch = branches.find((b) => b.id === branchId);
  const selectedBin = suggestedBins.find((b) => b.id === selBinId);
  const overCapacity =
    selectedBin && Number(qty || 0) > Number(selectedBin.remainingCapacity || 0);

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        {/* Top Operational Manifest Header (XuLyNhapKho.html) */}
        <section className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded bg-primary-fixed text-primary font-mono text-[11px] font-bold uppercase tracking-wider">
                UI09 · PB07 Receiving
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] text-[11px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-pulse" />
                Đang kiểm đếm nhập kho
              </span>
            </div>
            <h1 className="text-headline-lg font-bold text-on-surface tracking-tight">
              PHIẾU NHẬP KHO — {activeBranch ? activeBranch.code : 'CHỌN KHO'}
            </h1>
            <p className="text-body-sm text-on-surface-variant">
              Quét mã vạch kiểm đếm hàng nhập, gợi ý kệ Bin tự động theo sức chứa trống &amp; in
              phiếu nhiệt 80mm
            </p>
          </div>

          <div className="flex items-center gap-5 bg-surface-container-low rounded-xl px-5 py-3.5 shrink-0">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">Số dòng hàng</div>
              <div className="text-headline-md font-mono font-bold text-on-surface">
                {lines.length} SKU
              </div>
            </div>
            <div className="h-9 w-px bg-outline-variant/40" />
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Tổng SL kiểm đếm
              </div>
              <div className="text-headline-md font-mono font-bold text-primary">
                {totalUnits} ĐV
              </div>
            </div>
          </div>
        </section>

        {/* Ultra High-Speed Barcode Scanner Cockpit (XuLyNhapKho.html) */}
        <section className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            <div className="relative flex-1 rounded-xl bg-surface-container-low overflow-hidden shadow-[0_0_0_2px_rgba(29,78,216,0.2)] focus-within:shadow-[0_0_0_2px_#0037b0]">
              <div className="flex items-center h-[64px] px-4 gap-3">
                <span className="material-symbols-outlined text-error text-[26px] shrink-0">
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
                  placeholder="Quét súng laser hoặc nhập mã SKU / Barcode rồi nhấn Enter..."
                  className="flex-1 bg-transparent font-mono text-base font-semibold text-on-surface placeholder:text-outline focus:outline-none"
                />
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-error-container text-on-error-container text-[10px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping" />
                  LASER ACTIVE
                </span>
              </div>
              <div className="h-1 w-full bg-gradient-to-r from-primary-container via-emerald-500 to-primary-container opacity-75" />
            </div>

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="h-[64px] px-6 rounded-xl bg-primary-container hover:bg-primary text-white font-semibold text-label-lg flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[22px]">qr_code_scanner</span>
              <span>Quét Camera / Barcode</span>
            </button>
          </div>

          {/* Warehouse & Supplier Manifest Inputs */}
          <div className="grid gap-3 md:grid-cols-3 pt-1">
            <div className="space-y-1">
              <label className="text-label-sm font-bold uppercase text-outline">Kho nhập *</label>
              <Select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={!!user?.branchId && !user.roles.includes('ADMIN')}
                options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-label-sm font-bold uppercase text-outline">Nhà cung cấp</label>
              <Input
                placeholder="VD: Công ty TNHH Phân Phối ABC"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-label-sm font-bold uppercase text-outline">Ghi chú nhập</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>

          {/* Quick Manual Line Input */}
          <div className="rounded-xl bg-surface-container-low p-4 grid gap-3 md:grid-cols-6 items-end">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-on-surface">Sản phẩm (SKU)</label>
              <Select
                value={selProductId}
                onChange={(e) => setSelProductId(e.target.value)}
                options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface">
                Kệ cất (AI Put-Away)
              </label>
              <Select
                value={selBinId}
                onChange={(e) => setSelBinId(e.target.value)}
                options={suggestedBins.map((b) => ({
                  value: b.id,
                  label: `${b.code} (Trống ${b.remainingCapacity})`,
                }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface">Số lô (Batch)</label>
              <Input
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                className="bg-surface-container-lowest"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface">Hạn dùng (EXP)</label>
              <Input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="bg-surface-container-lowest"
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-20 bg-surface-container-lowest text-center font-mono font-bold"
              />
              <Button
                type="button"
                className="bg-primary-fixed hover:bg-primary-container text-primary hover:text-white font-semibold"
                onClick={() => {
                  const p = products.find((item) => item.id === selProductId);
                  if (p) addProductLine(p, Math.max(1, parseInt(qty || '1', 10)));
                }}
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </Button>
            </div>
          </div>

          {overCapacity && (
            <div className="rounded-xl bg-error-container p-3.5 text-body-sm text-on-error-container flex items-center gap-2.5">
              <span className="material-symbols-outlined text-error text-[20px]">warning</span>
              <span>
                <strong>Cảnh báo quá tải kệ {selectedBin?.code}:</strong> Số lượng dự kiến ({qty})
                vượt quá sức chứa trống còn lại ({selectedBin?.remainingCapacity}). Vui lòng tách sang
                kệ gợi ý khác.
              </span>
            </div>
          )}

          {/* Receiving Lines Table */}
          <div className="rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                  <th className="py-3 px-4 font-semibold">SKU / Sản phẩm</th>
                  <th className="py-3 px-4 font-semibold">Kệ Bin</th>
                  <th className="py-3 px-4 font-semibold">Lô &amp; HSD</th>
                  <th className="py-3 px-4 font-semibold">Số lượng nhập</th>
                  <th className="py-3 px-4 font-semibold text-right">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-body-sm">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-outline">
                      Chưa có dòng hàng nhập. Hãy quét mã vạch hoặc chọn sản phẩm ở trên.
                    </td>
                  </tr>
                ) : (
                  lines.map((l, i) => {
                    const binObj = suggestedBins.find((b) => b.id === l.binId);
                    return (
                      <tr
                        key={`${l.productId}-${l.binId}-${i}`}
                        className="bg-secondary-container/25 hover:bg-secondary-container/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-primary">{l.sku}</span> —{' '}
                          <span className="font-medium text-on-surface">{l.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded bg-surface-container-lowest text-primary font-mono font-bold text-xs shadow-xs">
                            {binObj?.code || l.binId}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-on-surface-variant">
                          {l.batchNo} {l.expDate ? `(${l.expDate})` : ''}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-primary text-base">
                          {l.qty}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                            className="p-1.5 rounded-lg text-error hover:bg-error-container/50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Inbound Tickets */}
        <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="px-6 py-4 bg-surface-container-low/50 flex items-center justify-between">
            <h2 className="text-headline-sm font-bold text-on-surface">
              Danh sách Phiếu Nhập Kho gần đây ({tickets.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                  <th className="py-3 pl-6 pr-3 font-semibold">Mã phiếu</th>
                  <th className="py-3 px-3 font-semibold">Kho / NCC</th>
                  <th className="py-3 px-3 font-semibold">Số dòng hàng</th>
                  <th className="py-3 px-3 font-semibold">Trạng thái</th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">In phiếu nhiệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-body-sm">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 pl-6 pr-3 font-mono font-bold text-primary">{t.code}</td>
                    <td className="py-3 px-3">
                      <p className="text-xs font-semibold text-on-surface">{t.branch.name}</p>
                      <p className="text-[11px] text-outline">{t.supplierName || '—'}</p>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">{t.details.length} mặt hàng</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          t.status === 'COMPLETED'
                            ? 'bg-[#ECFDF5] text-[#10B981]'
                            : 'bg-surface-container text-on-surface'
                        }`}
                      >
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

      {/* Sticky Bottom Action Footer (XuLyNhapKho.html) */}
      <div className="fixed bottom-0 left-0 lg:left-[260px] right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="text-body-sm text-on-surface-variant">
          Tổng cộng <strong className="font-mono text-on-surface">{lines.length}</strong> dòng ·{' '}
          <strong className="font-mono text-primary">{totalUnits}</strong> đơn vị sẵn sàng nhập kệ
        </div>
        <button
          type="button"
          onClick={handleConfirmInbound}
          disabled={submitting || lines.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-container hover:bg-primary disabled:opacity-50 text-white px-6 py-2.5 text-label-md font-bold shadow-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{submitting ? 'Đang xử lý...' : 'Hoàn tất kiểm đếm & Nhập kho'}</span>
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
