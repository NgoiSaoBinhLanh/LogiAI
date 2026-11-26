'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/services/api';
import { StockCheckApi } from '@/services/operations.service';
import { StockCheckItem } from '@/types/operations';
import { exportToExcel, exportToPdf } from '@/lib/export-utils';

export default function ApproveStockChecksPage() {
  const [checks, setChecks] = useState<StockCheckItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'ALL' | 'DIFF' | 'MATCH'>('ALL');
  const [searchSku, setSearchSku] = useState('');
  const [evidenceConfirmed, setEvidenceConfirmed] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    try {
      const res = await StockCheckApi.list({ limit: 50 });
      setChecks(res.items);
      if (res.items.length > 0 && !selectedId) {
        const pending = res.items.find((i) => i.status === 'PENDING_APPROVAL') || res.items[0];
        setSelectedId(pending.id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải danh sách kiểm kê');
    }
  }, [selectedId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selected = useMemo(
    () => checks.find((c) => c.id === selectedId) || null,
    [checks, selectedId]
  );

  const summary = useMemo(() => {
    if (!selected)
      return { total: 0, matched: 0, shortage: 0, surplus: 0, netValue: 0, lossVal: 0, gainVal: 0 };
    let matched = 0;
    let shortage = 0;
    let surplus = 0;
    let netValue = 0;
    let lossVal = 0;
    let gainVal = 0;

    for (const d of selected.details) {
      const val = d.discrepancyQty * d.product.costPrice;
      if (d.discrepancyQty === 0) matched++;
      else if (d.discrepancyQty < 0) {
        shortage++;
        lossVal += Math.abs(val);
      } else {
        surplus++;
        gainVal += val;
      }
      netValue += val;
    }

    return {
      total: selected.details.length,
      matched,
      shortage,
      surplus,
      netValue,
      lossVal,
      gainVal,
    };
  }, [selected]);

  const visibleDetails = useMemo(() => {
    if (!selected) return [];
    const kw = searchSku.trim().toLowerCase();
    return selected.details.filter((d) => {
      const matchTab =
        filterTab === 'DIFF'
          ? d.discrepancyQty !== 0
          : filterTab === 'MATCH'
            ? d.discrepancyQty === 0
            : true;
      const matchKw =
        !kw ||
        d.product.sku.toLowerCase().includes(kw) ||
        d.product.name.toLowerCase().includes(kw) ||
        d.bin.code.toLowerCase().includes(kw);
      return matchTab && matchKw;
    });
  }, [selected, filterTab, searchSku]);

  const handleApprove = async () => {
    if (!selected) return;
    if (!evidenceConfirmed) {
      toast.error('Vui lòng tích xác nhận đã kiểm tra ảnh camera và biên bản trước khi duyệt');
      return;
    }
    try {
      await StockCheckApi.approve(selected.id);
      toast.success('Đã phê duyệt điều chỉnh tồn kho và mở khóa giao dịch kệ hàng!');
      setEvidenceConfirmed(false);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Phê duyệt thất bại');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await StockCheckApi.reject(selected.id, rejectReason);
      toast.success('Đã từ chối và yêu cầu thủ kho kiểm đếm lại!');
      setRejectOpen(false);
      setRejectReason('');
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Danh sách phiếu kiểm kê */}
          <aside className="lg:col-span-4 bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="px-5 py-4 bg-surface-container-low/60 flex items-center justify-between">
              <h2 className="text-headline-sm font-bold text-on-surface">
                Phiếu Kiểm Kê ({checks.length})
              </h2>
              <span className="text-label-sm font-mono text-primary font-bold">PB15</span>
            </div>
            <div className="divide-y divide-surface-container-low max-h-[620px] overflow-y-auto custom-scrollbar">
              {checks.map((c) => {
                const isSelected = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      setEvidenceConfirmed(false);
                    }}
                    className={`w-full text-left p-4 relative transition-colors ${
                      isSelected
                        ? 'bg-secondary-container/40'
                        : 'hover:bg-surface-container-low/50'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container" />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-primary">{c.code}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'PENDING_APPROVAL'
                            ? 'bg-[#FFFBEB] text-[#D97706]'
                            : c.status === 'APPROVED'
                              ? 'bg-[#ECFDF5] text-[#10B981]'
                              : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {c.branch.name} · Lập bởi {c.creator.fullName}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Column: Audit Workspace (PheDuyePhieuKiemKe.html) */}
          <div className="lg:col-span-8 space-y-5">
            {selected ? (
              <>
                {/* 4-Col Audit Metadata Grid */}
                <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-headline-md font-bold text-on-surface">
                      Biên bản Đối chiếu &amp; Phê duyệt Kiểm kê {selected.code}
                    </h2>
                    <span className="px-2.5 py-1 rounded-full bg-primary-fixed text-primary font-mono text-xs font-bold">
                      {selected.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container-low/80 rounded-xl p-4 text-xs">
                    <div>
                      <span className="text-outline block">Mã phiếu kiểm kê</span>
                      <span className="font-mono font-bold text-on-surface">{selected.code}</span>
                    </div>
                    <div>
                      <span className="text-outline block">Chi nhánh / Kho</span>
                      <span className="font-semibold text-on-surface">{selected.branch.name}</span>
                    </div>
                    <div>
                      <span className="text-outline block">Cán bộ kiểm đếm</span>
                      <span className="font-semibold text-on-surface">
                        {selected.creator.fullName}
                      </span>
                    </div>
                    <div>
                      <span className="text-outline block">Ngày lập biên bản</span>
                      <span className="font-mono text-on-surface">
                        {new Date(selected.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4 KPI Summary Metric Cards with Bottom Bars (PheDuyePhieuKiemKe.html) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between gap-2">
                    <div className="text-label-sm uppercase text-outline font-semibold">
                      Tổng mặt hàng
                    </div>
                    <div className="text-headline-md font-mono font-bold text-on-surface">
                      {summary.total}
                    </div>
                    <div className="h-1 w-full rounded-full bg-primary-container" />
                  </div>

                  <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between gap-2">
                    <div className="text-label-sm uppercase text-outline font-semibold">
                      Khớp số lượng
                    </div>
                    <div className="text-headline-md font-mono font-bold text-[#10B981]">
                      {summary.matched}
                    </div>
                    <div className="h-1 w-full rounded-full bg-[#10B981]" />
                  </div>

                  <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between gap-2">
                    <div className="text-label-sm uppercase text-outline font-semibold">
                      Lệch thiếu (-)
                    </div>
                    <div className="text-headline-md font-mono font-bold text-error">
                      {summary.shortage}
                    </div>
                    <div className="h-1 w-full rounded-full bg-error" />
                  </div>

                  <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between gap-2">
                    <div className="text-label-sm uppercase text-outline font-semibold">
                      Lệch thừa (+)
                    </div>
                    <div className="text-headline-md font-mono font-bold text-primary">
                      {summary.surplus}
                    </div>
                    <div className="h-1 w-full rounded-full bg-primary-fixed-dim" />
                  </div>
                </div>

                {/* Reconciliation Table Card */}
                <div className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
                  <div className="p-4 bg-surface-container-low/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex bg-surface-container-lowest p-1 rounded-lg shadow-xs">
                      {(
                        [
                          { id: 'ALL', label: `Tất cả (${summary.total})` },
                          { id: 'DIFF', label: `Có chênh lệch (${summary.shortage + summary.surplus})` },
                          { id: 'MATCH', label: `Khớp (${summary.matched})` },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFilterTab(t.id)}
                          className={`px-3 py-1 rounded-md text-label-sm font-semibold ${
                            filterTab === t.id
                              ? 'bg-primary-container text-white'
                              : 'text-on-surface-variant'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-56">
                      <span className="material-symbols-outlined text-outline text-[17px] absolute left-2.5 top-2">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Lọc SKU, kệ..."
                        value={searchSku}
                        onChange={(e) => setSearchSku(e.target.value)}
                        className="w-full h-8 rounded-lg bg-surface-container-lowest pl-8 pr-3 text-xs shadow-[0_0_0_1px_#c4c5d7] focus:outline-none focus:shadow-[0_0_0_2px_#0037b0]"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                          <th className="py-3 px-4 font-semibold">SKU / Kệ</th>
                          <th className="py-3 px-4 font-semibold text-right">Sổ sách</th>
                          <th className="py-3 px-4 font-semibold text-right">Thực tế</th>
                          <th className="py-3 px-4 font-semibold text-center">Chênh lệch</th>
                          <th className="py-3 px-4 font-semibold text-right">Giá trị lệch</th>
                          <th className="py-3 px-4 font-semibold">Giải trình</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-low text-body-sm">
                        {visibleDetails.map((d) => {
                          const diffVal = d.discrepancyQty * d.product.costPrice;
                          return (
                            <tr
                              key={d.id}
                              className="hover:bg-surface-container-low/40 transition-colors"
                            >
                              <td className="py-3 px-4">
                                <div className="font-mono font-bold text-xs text-primary">
                                  {d.product.sku}
                                </div>
                                <div className="text-[11px] text-outline">
                                  {d.product.name} · Kệ {d.bin.code}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono">{d.qtySystem}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold">
                                {d.qtyActual}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                                    d.discrepancyQty === 0
                                      ? 'bg-[#ECFDF5] text-[#10B981]'
                                      : d.discrepancyQty > 0
                                        ? 'bg-primary-fixed text-primary'
                                        : 'bg-error-container text-on-error-container'
                                  }`}
                                >
                                  {d.discrepancyQty === 0
                                    ? '0 Khớp'
                                    : d.discrepancyQty > 0
                                      ? `+${d.discrepancyQty} Thừa`
                                      : `${d.discrepancyQty} Thiếu`}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-xs font-semibold">
                                {diffVal.toLocaleString('vi-VN')} đ
                              </td>
                              <td className="py-3 px-4 text-xs text-on-surface-variant">
                                {d.reason || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 8 / 4 Financial Reconciliation Summary Block (PheDuyePhieuKiemKe.html) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-2.5">
                    <div className="text-label-sm font-bold uppercase text-outline">
                      Bút toán Đối chiếu Kế toán (Tài khoản Hạch toán)
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                      <div className="bg-surface-container-low rounded-lg p-3">
                        <div className="font-mono font-bold text-primary">TK 156</div>
                        <div className="text-outline mt-0.5">Kho hàng hóa gốc</div>
                      </div>
                      <div className="bg-surface-container-low rounded-lg p-3">
                        <div className="font-mono font-bold text-error">TK 1388</div>
                        <div className="text-on-surface font-mono font-semibold mt-0.5">
                          -{summary.lossVal.toLocaleString('vi-VN')} đ
                        </div>
                      </div>
                      <div className="bg-surface-container-low rounded-lg p-3">
                        <div className="font-mono font-bold text-[#10B981]">TK 3381</div>
                        <div className="text-on-surface font-mono font-semibold mt-0.5">
                          +{summary.gainVal.toLocaleString('vi-VN')} đ
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4 bg-inverse-surface rounded-xl p-5 text-white flex flex-col justify-center">
                    <span className="text-label-sm text-primary-fixed-dim uppercase font-semibold">
                      Chênh lệch ròng (Net Variance)
                    </span>
                    <span
                      className={`text-headline-md font-mono font-bold mt-1 ${
                        summary.netValue < 0 ? 'text-rose-300' : 'text-emerald-300'
                      }`}
                    >
                      {summary.netValue > 0 ? '+' : ''}
                      {summary.netValue.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-surface-container-lowest rounded-xl p-12 text-center text-outline shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                Chọn phiếu kiểm kê bên trái để xem chi tiết
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Approval Bar (PheDuyePhieuKiemKe.html) */}
      {selected && (
        <div className="fixed bottom-0 left-0 lg:left-[260px] right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {selected.status === 'PENDING_APPROVAL' ? (
            <label className="flex items-center gap-2 text-xs font-medium text-on-surface cursor-pointer select-none">
              <Checkbox
                checked={evidenceConfirmed}
                onCheckedChange={(c) => setEvidenceConfirmed(c === true)}
              />
              <span>
                Xác nhận đã kiểm tra ảnh camera hiện trường và biên bản kiểm đếm thực tế
              </span>
            </label>
          ) : (
            <span className="text-xs text-outline">
              Phiếu <strong className="font-mono text-on-surface">{selected.code}</strong> đã ở
              trạng thái <strong>{selected.status}</strong>
            </span>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportToExcel(
                  `kiem-ke-${selected.code}`,
                  'KiemKe',
                  selected.details.map((d) => ({
                    SKU: d.product.sku,
                    TenSP: d.product.name,
                    Ke: d.bin.code,
                    SoSach: d.qtySystem,
                    ThucTe: d.qtyActual,
                    ChenhLech: d.discrepancyQty,
                    GiaiTrinh: d.reason || '',
                  }))
                )
              }
              className="inline-flex items-center gap-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface px-3 py-2 text-label-sm font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">table_view</span>
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportToPdf(
                  `kiem-ke-${selected.code}`,
                  `BIÊN BẢN KIỂM KÊ ${selected.code} (${selected.branch.name})`,
                  ['SKU', 'Tên SP', 'Kệ', 'Sổ sách', 'Thực tế', 'Chênh lệch'],
                  selected.details.map((d) => [
                    d.product.sku,
                    d.product.name,
                    d.bin.code,
                    d.qtySystem,
                    d.qtyActual,
                    d.discrepancyQty,
                  ])
                )
              }
              className="inline-flex items-center gap-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface px-3 py-2 text-label-sm font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              <span>PDF</span>
            </button>

            {selected.status === 'PENDING_APPROVAL' && (
              <>
                <button
                  type="button"
                  onClick={() => setRejectOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-error-container hover:bg-error hover:text-white text-on-error-container px-4 py-2 text-label-md font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">cancel</span>
                  <span>Từ chối</span>
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-5 py-2 text-label-md font-bold shadow-sm transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">check_circle</span>
                  <span>Phê duyệt điều chỉnh tồn kho</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Từ chối phiếu kiểm kê {selected?.code}</DialogTitle>
            <DialogDescription>
              Nhập lý do bắt buộc để nhân viên kho tiến hành kiểm đếm lại lần 2
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReject} className="space-y-4">
            <Input
              placeholder="Ví dụ: Số lệch vượt ngưỡng, yêu cầu đếm lại kệ C01..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="destructive">
                Xác nhận từ chối
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
