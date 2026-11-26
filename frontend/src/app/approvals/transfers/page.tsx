'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { BarcodeScannerDialog } from '@/components/barcode/barcode-scanner-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/services/api';
import {
  BranchOpsApi,
  InventoryApi,
  ProductApi,
  TransferApi,
} from '@/services/operations.service';
import {
  BranchDetailItem,
  ProductItem,
  SuggestedBinItem,
  TransferTicketItem,
} from '@/types/operations';

export default function TransfersApprovalPage() {
  const [transfers, setTransfers] = useState<TransferTicketItem[]>([]);
  const [branches, setBranches] = useState<BranchDetailItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);

  // Dialog Tạo lệnh điều chuyển (PB13)
  const [createOpen, setCreateOpen] = useState(false);
  const [srcBranchId, setSrcBranchId] = useState('');
  const [dstBranchId, setDstBranchId] = useState('');
  const [selProdId, setSelProdId] = useState('');
  const [reqQty, setReqQty] = useState('10');
  const [driverName, setDriverName] = useState('Nguyễn Văn Tài');
  const [vehiclePlate, setVehiclePlate] = useState('51C-889.99');

  // Dialog Ký duyệt lệnh chuyển kho (UI08 / PB16)
  const [approveTarget, setApproveTarget] = useState<TransferTicketItem | null>(null);
  const [adjustedQty, setAdjustedQty] = useState<Record<string, number>>({});
  const [confirmSafeStock, setConfirmSafeStock] = useState(false);

  // Dialog Tiếp nhận hàng điều chuyển (PB10)
  const [receiveTarget, setReceiveTarget] = useState<TransferTicketItem | null>(null);
  const [destBins, setDestBins] = useState<SuggestedBinItem[]>([]);
  const [targetBinId, setTargetBinId] = useState('');
  const [receivedMap, setReceivedMap] = useState<Record<string, { qty: number; reason: string }>>(
    {}
  );
  const [scannerOpen, setScannerOpen] = useState(false);
  const [statusTab, setStatusTab] = useState<'ALL' | 'PENDING' | 'IN_TRANSIT' | 'HISTORY'>('ALL');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [tRes, bRes, pRes] = await Promise.all([
        TransferApi.list({ limit: 30 }),
        BranchOpsApi.list(),
        ProductApi.list({ limit: 100 }),
      ]);
      setTransfers(tRes.items);
      setBranches(bRes.branches);
      setProducts(pRes.items);
      if (bRes.branches.length >= 2 && !srcBranchId) {
        setSrcBranchId(bRes.branches[0].id);
        setDstBranchId(bRes.branches[1].id);
      }
      if (pRes.items.length > 0 && !selProdId) {
        setSelProdId(pRes.items[0].id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải danh sách điều chuyển');
    }
  }, [srcBranchId, selProdId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await TransferApi.create({
        sourceBranchId: srcBranchId,
        destBranchId: dstBranchId,
        driverName,
        vehiclePlate,
        items: [{ productId: selProdId, qtyRequested: parseInt(reqQty, 10) }],
      });
      toast.success('Đã tạo yêu cầu điều chuyển và giữ chỗ tồn kho nguồn!');
      setCreateOpen(false);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Tạo phiếu điều chuyển thất bại');
    }
  };

  const openApproveDialog = (t: TransferTicketItem) => {
    setApproveTarget(t);
    const map: Record<string, number> = {};
    for (const d of t.details) {
      map[d.id] = d.qtyRequested;
    }
    setAdjustedQty(map);
    setConfirmSafeStock(false);
  };

  const handleConfirmApprove = async () => {
    if (!approveTarget) return;
    if (!confirmSafeStock) {
      toast.error('Vui lòng tích xác nhận đã đối chiếu năng lực tồn kho an toàn');
      return;
    }
    try {
      await TransferApi.approve(
        approveTarget.id,
        Object.entries(adjustedQty).map(([detailId, qtyRequested]) => ({
          detailId,
          qtyRequested,
        }))
      );
      toast.success(`Đã ký duyệt điện tử lệnh ${approveTarget.code}!`);
      setApproveTarget(null);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Ký duyệt thất bại');
    }
  };

  const handleRejectTransfer = async (id: string) => {
    try {
      await TransferApi.reject(id);
      toast.success('Đã từ chối lệnh điều chuyển và giải phóng tồn giữ chỗ!');
      setApproveTarget(null);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Từ chối thất bại');
    }
  };

  const handleDispatch = async (id: string) => {
    try {
      await TransferApi.dispatch(id);
      toast.success('Đã xác nhận xuất bến — Chuyến hàng đang vận chuyển!');
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Xuất bến thất bại');
    }
  };

  const openReceiveDialog = async (t: TransferTicketItem) => {
    setReceiveTarget(t);
    const map: Record<string, { qty: number; reason: string }> = {};
    for (const d of t.details) {
      map[d.id] = { qty: d.qtyRequested, reason: '' };
    }
    setReceivedMap(map);
    try {
      const res = await InventoryApi.suggestBins(t.destBranchId);
      setDestBins(res.bins);
      if (res.bins.length > 0) setTargetBinId(res.bins[0].id);
    } catch {
      setDestBins([]);
    }
  };

  const handleReceiveConfirm = async () => {
    if (!receiveTarget || !targetBinId) return;
    try {
      await TransferApi.receive(receiveTarget.id, {
        targetBinId,
        items: Object.entries(receivedMap).map(([detailId, val]) => ({
          detailId,
          qtyReceived: val.qty,
          discrepancyReason: val.reason || undefined,
        })),
      });
      toast.success('Đã xác nhận tiếp nhận hàng điều chuyển vào kho đích!');
      setReceiveTarget(null);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Tiếp nhận thất bại');
    }
  };

  const handleScanTransferCode = (code: string) => {
    const found = transfers.find(
      (t) => t.code.toLowerCase() === code.toLowerCase() && t.status === 'IN_TRANSIT'
    );
    if (!found) {
      toast.error(`Không tìm thấy chuyến điều chuyển Đang vận chuyển có mã: ${code}`);
      return;
    }
    openReceiveDialog(found);
  };

  const pendingApproveCount = transfers.filter((t) => t.status === 'PENDING').length;
  const approvedCount = transfers.filter((t) => t.status === 'APPROVED').length;
  const transitCount = transfers.filter((t) => t.status === 'IN_TRANSIT').length;
  const historyCount = transfers.filter(
    (t) => t.status === 'RECEIVED' || t.status === 'DISCREPANCY' || t.status === 'CANCELLED'
  ).length;

  const visibleTransfers = transfers.filter((t) => {
    const matchTab =
      statusTab === 'PENDING'
        ? t.status === 'PENDING' || t.status === 'APPROVED'
        : statusTab === 'IN_TRANSIT'
          ? t.status === 'IN_TRANSIT'
          : statusTab === 'HISTORY'
            ? t.status === 'RECEIVED' || t.status === 'DISCREPANCY' || t.status === 'CANCELLED'
            : true;
    const kw = search.trim().toLowerCase();
    const matchKw =
      !kw ||
      t.code.toLowerCase().includes(kw) ||
      t.sourceBranch.code.toLowerCase().includes(kw) ||
      t.destBranch.code.toLowerCase().includes(kw);
    return matchTab && matchKw;
  });

  return (
    <AppShell>
      {/* Full-bleed Sub-header Command Bar (QunaLyLuanChuyenLienChiNhanh.html) */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-label-md text-outline">
            <span>Phê duyệt chi nhánh</span>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="text-primary font-semibold">
              Luân chuyển Liên Chi nhánh (UI08 / PB10 / PB13)
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Tạo yêu cầu → Kho nguồn ký duyệt điện tử → Xuất xe → Kho đích quét nhận
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary px-3.5 py-2 text-label-md font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            <span>Quét mã phiếu nhận</span>
          </button>

          <PermissionGuard anyOf={['TRANSFER_TRACK', 'TICKET_CREATE']}>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-2 text-label-md font-semibold shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Tạo lệnh điều chuyển mới</span>
            </button>
          </PermissionGuard>
        </div>
      </div>

      <div className="space-y-6">
        {/* 4 KPI Metric Cards Grid (QunaLyLuanChuyenLienChiNhanh.html) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary-container" />
            <div className="pl-2 flex items-center justify-between">
              <div>
                <div className="text-label-sm uppercase text-primary font-bold">Cần xử lý ngay</div>
                <div className="text-headline-md font-mono font-bold text-on-surface mt-1">
                  {pendingApproveCount}
                </div>
              </div>
              <span className="material-symbols-outlined text-primary text-[26px]">pending_actions</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Chờ xuất bến
              </div>
              <div className="text-headline-md font-mono font-bold text-amber-600 mt-1">
                {approvedCount}
              </div>
            </div>
            <span className="material-symbols-outlined text-amber-500 text-[26px]">inventory</span>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Đang vận chuyển
              </div>
              <div className="text-headline-md font-mono font-bold text-primary mt-1">
                {transitCount}
              </div>
            </div>
            <span className="material-symbols-outlined text-primary text-[26px]">local_shipping</span>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">Hoàn tất</div>
              <div className="text-headline-md font-mono font-bold text-[#10B981] mt-1">
                {historyCount}
              </div>
            </div>
            <span className="material-symbols-outlined text-[#10B981] text-[26px]">
              check_circle
            </span>
          </div>
        </div>

        {/* Connected Tabs + Search + Table Card */}
        <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="px-6 pt-4 pb-3 border-b border-surface-container-low flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'ALL', label: `Tất cả (${transfers.length})` },
                  { id: 'PENDING', label: `Chờ duyệt / Xuất (${pendingApproveCount + approvedCount})` },
                  { id: 'IN_TRANSIT', label: `Đang vận chuyển (${transitCount})` },
                  { id: 'HISTORY', label: `Lịch sử (${historyCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  className={`px-4 py-2 text-label-md font-semibold border-b-2 transition-colors ${
                    statusTab === tab.id
                      ? 'border-primary-container text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-64">
              <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã lệnh, mã kho..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 rounded-lg bg-surface-container-low pl-9 pr-3 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                  <th className="py-3 pl-6 pr-3 font-semibold">Mã lệnh</th>
                  <th className="py-3 px-3 font-semibold">Tuyến điều chuyển</th>
                  <th className="py-3 px-3 font-semibold">Mặt hàng</th>
                  <th className="py-3 px-3 font-semibold">Phương tiện &amp; ETA</th>
                  <th className="py-3 px-3 font-semibold">Trạng thái</th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-body-sm">
                {visibleTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3.5 pl-6 pr-3">
                      <span className="font-mono font-bold text-primary">{t.code}</span>
                      {t.aiSuggested && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-primary-fixed text-primary text-[10px] font-bold">
                          AI ({t.aiConfidence}%)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                        <span className="rounded bg-surface-container-low px-2 py-0.5 text-on-surface">
                          {t.sourceBranch.code}
                        </span>
                        <span className="material-symbols-outlined text-primary text-[16px]">
                          arrow_forward
                        </span>
                        <span className="rounded bg-primary-fixed px-2 py-0.5 text-primary">
                          {t.destBranch.code}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-xs text-on-surface">
                      {t.details.map((d) => (
                        <div key={d.id}>
                          <span className="font-mono font-bold">{d.product.sku}</span>:{' '}
                          <span className="font-mono">{d.qtyRequested}</span> {d.product.unit}
                        </div>
                      ))}
                    </td>
                    <td className="py-3.5 px-3 text-xs text-on-surface-variant">
                      <div className="font-medium text-on-surface">
                        {t.vehiclePlate || t.transportMethod || '—'}
                      </div>
                      <div className="text-[11px] font-mono text-outline">
                        ETA: {t.eta ? new Date(t.eta).toLocaleString('vi-VN') : '—'}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          t.status === 'RECEIVED'
                            ? 'bg-[#ECFDF5] text-[#10B981]'
                            : t.status === 'DISCREPANCY' || t.status === 'CANCELLED'
                              ? 'bg-error-container text-on-error-container'
                              : t.status === 'IN_TRANSIT'
                                ? 'bg-primary-fixed text-primary'
                                : 'bg-[#FFFBEB] text-[#D97706]'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 pl-3 pr-6 text-right space-x-1.5">
                      {t.status === 'PENDING' && (
                        <PermissionGuard permission="TICKET_APPROVE">
                          <button
                            type="button"
                            onClick={() => openApproveDialog(t)}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary-container hover:bg-primary text-white px-3 py-1.5 text-label-sm font-semibold shadow-xs transition-colors"
                          >
                            Xem &amp; Duyệt
                          </button>
                        </PermissionGuard>
                      )}
                      {t.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => handleDispatch(t.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-secondary-container hover:bg-primary-container hover:text-white text-on-surface px-3 py-1.5 text-label-sm font-semibold transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            local_shipping
                          </span>
                          <span>Xuất xe</span>
                        </button>
                      )}
                      {t.status === 'IN_TRANSIT' && (
                        <button
                          type="button"
                          onClick={() => openReceiveDialog(t)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-container hover:bg-primary text-white px-3 py-1.5 text-label-sm font-semibold transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">inventory</span>
                          <span>Tiếp nhận</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Dialog Tạo Lệnh Điều Chuyển (PB13) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Tạo Yêu Cầu Điều Chuyển Liên Kho (PB13)</DialogTitle>
            <DialogDescription>
              Kho nguồn phải khác kho đích và còn đủ tồn khả dụng để giữ chỗ
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTransfer} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Kho xuất (Nguồn)</label>
                <Select
                  value={srcBranchId}
                  onChange={(e) => setSrcBranchId(e.target.value)}
                  options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Kho nhập (Đích)</label>
                <Select
                  value={dstBranchId}
                  onChange={(e) => setDstBranchId(e.target.value)}
                  options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium">Sản phẩm (SKU)</label>
                <Select
                  value={selProdId}
                  onChange={(e) => setSelProdId(e.target.value)}
                  options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Số lượng</label>
                <Input
                  type="number"
                  min={1}
                  value={reqQty}
                  onChange={(e) => setReqQty(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Tên tài xế"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
              <Input
                placeholder="Biển số xe"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" className="bg-primary-container hover:bg-primary text-white">
                Gửi lệnh điều chuyển
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Ký Duyệt Lệnh Điều Chuyển (UI08 / QunaLyLuanChuyenLienChiNhanh.html) */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-2xl">
          <div className="h-1.5 w-full bg-primary-container" />
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-headline-md font-bold">
                Ký Duyệt Lệnh Chuyển Kho —{' '}
                <span className="font-mono text-primary">{approveTarget?.code}</span>
              </DialogTitle>
              <DialogDescription>
                Điều chỉnh số lượng thực xuất và xác nhận đối chiếu năng lực tồn kho an toàn (PB16)
              </DialogDescription>
            </DialogHeader>

            {approveTarget && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-container-low p-3.5 text-xs">
                  <div>
                    <span className="text-outline block">Kho xuất (Nguồn)</span>
                    <span className="font-bold text-on-surface">
                      {approveTarget.sourceBranch.code} · {approveTarget.sourceBranch.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-outline block">Kho nhận (Đích)</span>
                    <span className="font-bold text-primary">
                      {approveTarget.destBranch.code} · {approveTarget.destBranch.name}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden bg-surface-container-low/40">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-surface-container-low text-on-surface-variant uppercase">
                        <th className="py-2.5 px-3 font-semibold">SKU</th>
                        <th className="py-2.5 px-3 font-semibold">Tên sản phẩm</th>
                        <th className="py-2.5 px-3 font-semibold">Tồn nguồn</th>
                        <th className="py-2.5 px-3 font-semibold">SL Duyệt xuất</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-low">
                      {approveTarget.details.map((d) => {
                        const qtyVal = adjustedQty[d.id] ?? d.qtyRequested;
                        const remain = d.sourceAvailable - qtyVal;
                        const warning = remain < d.product.minStock;
                        return (
                          <React.Fragment key={d.id}>
                            <tr>
                              <td className="py-2.5 px-3 font-mono font-bold text-primary">
                                {d.product.sku}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-on-surface">
                                {d.product.name}
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                {d.sourceAvailable} (Min: {d.product.minStock})
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAdjustedQty((prev) => ({
                                        ...prev,
                                        [d.id]: Math.max(1, qtyVal - 1),
                                      }))
                                    }
                                    className="w-7 h-7 rounded bg-surface-container hover:bg-surface-container-high font-bold"
                                  >
                                    -
                                  </button>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={d.sourceAvailable}
                                    value={qtyVal}
                                    onChange={(e) =>
                                      setAdjustedQty((prev) => ({
                                        ...prev,
                                        [d.id]: Math.max(1, parseInt(e.target.value || '1', 10)),
                                      }))
                                    }
                                    className="w-16 h-7 text-center font-mono font-bold"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAdjustedQty((prev) => ({
                                        ...prev,
                                        [d.id]: Math.min(d.sourceAvailable, qtyVal + 1),
                                      }))
                                    }
                                    className="w-7 h-7 rounded bg-surface-container hover:bg-surface-container-high font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {warning && (
                              <tr className="bg-[#FEF2F2]">
                                <td colSpan={4} className="py-2 px-3 text-error text-xs font-medium">
                                  Cảnh báo tồn kho an toàn: Tồn kho sau xuất ({remain}) xuống dưới
                                  ngưỡng an toàn ({d.product.minStock})
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={confirmSafeStock}
                    onCheckedChange={(c) => setConfirmSafeStock(c === true)}
                  />
                  <span>Xác nhận đã đối chiếu năng lực tồn kho an toàn tại kho nguồn</span>
                </label>

                <DialogFooter className="gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleRejectTransfer(approveTarget.id)}
                  >
                    Từ chối lệnh
                  </Button>
                  <Button
                    onClick={handleConfirmApprove}
                    className="bg-primary-container hover:bg-primary text-white"
                  >
                    Ký duyệt điện tử
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Tiếp Nhận Hàng Điều Chuyển (PB10) */}
      <Dialog open={!!receiveTarget} onOpenChange={(o) => !o && setReceiveTarget(null)}>
        <DialogContent className="sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Tiếp Nhận Hàng Điều Chuyển — {receiveTarget?.code}</DialogTitle>
            <DialogDescription>
              Xác nhận số lượng thực nhận tại kho đích {receiveTarget?.destBranch.code}. Nếu thiếu
              sẽ tự ghi nhận DISCREPANCY
            </DialogDescription>
          </DialogHeader>

          {receiveTarget && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Kệ Bin tiếp nhận vào kho đích *</label>
                <Select
                  value={targetBinId}
                  onChange={(e) => setTargetBinId(e.target.value)}
                  options={destBins.map((b) => ({
                    value: b.id,
                    label: `${b.code} (${b.zoneCode} · Trống ${b.remainingCapacity})`,
                  }))}
                />
              </div>

              <div className="rounded-xl overflow-hidden bg-surface-container-low/40">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant uppercase">
                      <th className="py-2.5 px-3 font-semibold">SKU</th>
                      <th className="py-2.5 px-3 font-semibold">SL xuất</th>
                      <th className="py-2.5 px-3 font-semibold">SL thực nhận</th>
                      <th className="py-2.5 px-3 font-semibold">Ghi chú sai lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {receiveTarget.details.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 px-3 font-mono font-bold text-primary">
                          {d.product.sku}
                        </td>
                        <td className="py-2 px-3 font-mono">{d.qtyRequested}</td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min={0}
                            value={receivedMap[d.id]?.qty ?? d.qtyRequested}
                            onChange={(e) =>
                              setReceivedMap((prev) => ({
                                ...prev,
                                [d.id]: {
                                  qty: Math.max(0, parseInt(e.target.value || '0', 10)),
                                  reason: prev[d.id]?.reason || '',
                                },
                              }))
                            }
                            className="w-20 h-8 font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            placeholder="Nếu thiếu/hỏng..."
                            value={receivedMap[d.id]?.reason ?? ''}
                            onChange={(e) =>
                              setReceivedMap((prev) => ({
                                ...prev,
                                [d.id]: {
                                  qty: prev[d.id]?.qty ?? d.qtyRequested,
                                  reason: e.target.value,
                                },
                              }))
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setReceiveTarget(null)}>
                  Hủy
                </Button>
                <Button
                  onClick={handleReceiveConfirm}
                  className="bg-primary-container hover:bg-primary text-white"
                >
                  Xác nhận nhập kho nhận
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScanTransferCode}
        title="Quét mã Phiếu Điều Chuyển (PB10)"
      />
    </AppShell>
  );
}
