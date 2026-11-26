'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { BarcodeScannerDialog } from '@/components/barcode/barcode-scanner-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/services/api';
import { BranchOpsApi, StockCheckApi } from '@/services/operations.service';
import { BranchDetailItem, StockCheckItem } from '@/types/operations';
import { useAuth } from '@/store/auth-context';

export default function StockChecksPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchDetailItem[]>([]);
  const [checks, setChecks] = useState<StockCheckItem[]>([]);
  const [selected, setSelected] = useState<StockCheckItem | null>(null);
  const [branchId, setBranchId] = useState('');
  const [draftCounts, setDraftCounts] = useState<
    Record<string, { qtyActual: number; reason: string }>
  >({});
  const [scannerOpen, setScannerOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [bRes, scRes] = await Promise.all([
        BranchOpsApi.list(),
        StockCheckApi.list({ limit: 20 }),
      ]);
      setBranches(bRes.branches);
      setChecks(scRes.items);
      if (!branchId) setBranchId(user?.branchId || bRes.branches[0]?.id || '');

      if (scRes.items.length > 0) {
        const target =
          (selected && scRes.items.find((i) => i.id === selected.id)) || scRes.items[0];
        setSelected(target);
        const map: Record<string, { qtyActual: number; reason: string }> = {};
        for (const d of target.details) {
          map[d.id] = { qtyActual: d.qtyActual, reason: d.reason || '' };
        }
        setDraftCounts(map);
      }
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải danh sách kiểm kê');
    }
  }, [user?.branchId, branchId, selected]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateStockCheck = async () => {
    if (!branchId) return;
    try {
      const res = await StockCheckApi.create({ branchId });
      toast.success(
        `Đã tạo đợt kiểm kê ${res.stockCheck.code} và khóa giao dịch các mặt hàng liên quan!`
      );
      setSelected(res.stockCheck);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể tạo đợt kiểm kê');
    }
  };

  const handleSaveCounts = async () => {
    if (!selected) return;
    try {
      await StockCheckApi.updateCounts(
        selected.id,
        Object.entries(draftCounts).map(([detailId, val]) => ({
          detailId,
          qtyActual: val.qtyActual,
          reason: val.reason || undefined,
        }))
      );
      toast.success('Đã lưu số liệu kiểm đếm thực tế');
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lưu thất bại');
    }
  };

  const handleSubmitApproval = async () => {
    if (!selected) return;
    try {
      await handleSaveCounts();
      await StockCheckApi.submit(selected.id);
      toast.success('Đã gửi phiếu kiểm kê lên Quản lý chi nhánh phê duyệt!');
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Gửi duyệt thất bại');
    }
  };

  const handleBarcodeScan = (code: string) => {
    if (!selected) return;
    const detail = selected.details.find(
      (d) =>
        d.product.barcode.toLowerCase() === code.toLowerCase() ||
        d.product.sku.toLowerCase() === code.toLowerCase()
    );
    if (!detail) {
      toast.error(`Mã ${code} không nằm trong phiếu kiểm kê ${selected.code}`);
      return;
    }
    setDraftCounts((prev) => ({
      ...prev,
      [detail.id]: {
        qtyActual: (prev[detail.id]?.qtyActual ?? 0) + 1,
        reason: prev[detail.id]?.reason || '',
      },
    }));
    toast.success(`Đã cộng +1 thực đếm cho ${detail.product.sku}`);
  };

  return (
    <AppShell>
      {/* Full-bleed Sub-header Context Strip */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-label-md text-outline">
            <span>Vận hành kho</span>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="text-primary font-semibold">Kiểm kê Kho &amp; Ghi nhận Độ lệch (PB09)</span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Tạo đợt kiểm kê (tạm khóa giao dịch phạm vi kiểm đếm), nhập số thực tế và gửi duyệt
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-56">
            <Select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={!!user?.branchId && !user.roles.includes('ADMIN')}
              options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
            />
          </div>
          <button
            type="button"
            onClick={handleCreateStockCheck}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-2 text-label-md font-semibold shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_task</span>
            <span>Tạo đợt kiểm kê mới</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left List */}
        <aside className="lg:col-span-4 bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="px-5 py-4 bg-surface-container-low/60 flex items-center justify-between">
            <h2 className="text-headline-sm font-bold text-on-surface">
              Đợt kiểm kê ({checks.length})
            </h2>
            <span className="text-label-sm font-mono text-primary font-bold">Cycle Count</span>
          </div>
          <div className="divide-y divide-surface-container-low max-h-[580px] overflow-y-auto custom-scrollbar">
            {checks.map((c) => {
              const active = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelected(c);
                    const map: Record<string, { qtyActual: number; reason: string }> = {};
                    for (const d of c.details) {
                      map[d.id] = { qtyActual: d.qtyActual, reason: d.reason || '' };
                    }
                    setDraftCounts(map);
                  }}
                  className={`w-full text-left p-4 relative transition-colors ${
                    active ? 'bg-secondary-container/40' : 'hover:bg-surface-container-low/50'
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container" />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-primary">{c.code}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === 'APPROVED'
                          ? 'bg-[#ECFDF5] text-[#10B981]'
                          : c.status === 'PENDING_APPROVAL'
                            ? 'bg-[#FFFBEB] text-[#D97706]'
                            : 'bg-surface-container text-on-surface'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {c.branch.name} · {c.details.length} dòng hàng
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Audit Entry Panel */}
        <section className="lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
          {selected ? (
            <>
              <div className="p-5 bg-surface-container-low/50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-headline-md font-bold text-on-surface">
                    Phiếu Kiểm Kê {selected.code}
                  </h2>
                  <p className="text-body-sm text-on-surface-variant">
                    {selected.branch.name} · Trạng thái: <strong>{selected.status}</strong>
                  </p>
                </div>

                {selected.status === 'COUNTING' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-lowest hover:bg-primary-fixed text-primary px-3.5 py-2 text-label-md font-semibold shadow-xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                      <span>Quét Barcode</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCounts}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface px-3.5 py-2 text-label-md font-semibold transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>Lưu nháp</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitApproval}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-2 text-label-md font-bold shadow-sm transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      <span>Gửi duyệt</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                      <th className="py-3 pl-5 pr-3 font-semibold">SKU / Kệ</th>
                      <th className="py-3 px-3 font-semibold text-right">Sổ sách</th>
                      <th className="py-3 px-3 font-semibold">Thực đếm</th>
                      <th className="py-3 px-3 font-semibold">Chênh lệch</th>
                      <th className="py-3 pl-3 pr-5 font-semibold">Giải trình</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low text-body-sm">
                    {selected.details.map((d) => {
                      const actual = draftCounts[d.id]?.qtyActual ?? d.qtyActual;
                      const diff = actual - d.qtySystem;
                      return (
                        <tr key={d.id} className="hover:bg-surface-container-low/40">
                          <td className="py-3 pl-5 pr-3">
                            <div className="font-mono font-bold text-xs text-primary">
                              {d.product.sku}
                            </div>
                            <div className="text-[11px] text-outline">
                              {d.product.name} · Kệ {d.bin.code}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            {d.qtySystem}
                          </td>
                          <td className="py-3 px-3">
                            <Input
                              type="number"
                              min={0}
                              disabled={selected.status !== 'COUNTING'}
                              value={actual}
                              onChange={(e) =>
                                setDraftCounts((prev) => ({
                                  ...prev,
                                  [d.id]: {
                                    qtyActual: Math.max(0, parseInt(e.target.value || '0', 10)),
                                    reason: prev[d.id]?.reason || '',
                                  },
                                }))
                              }
                              className="w-24 h-8 rounded-lg text-center font-mono font-bold"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                                diff === 0
                                  ? 'bg-[#ECFDF5] text-[#10B981]'
                                  : diff > 0
                                    ? 'bg-primary-fixed text-primary'
                                    : 'bg-error-container text-on-error-container'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          </td>
                          <td className="py-3 pl-3 pr-5">
                            <Input
                              placeholder="Lý do lệch..."
                              disabled={selected.status !== 'COUNTING'}
                              value={draftCounts[d.id]?.reason ?? ''}
                              onChange={(e) =>
                                setDraftCounts((prev) => ({
                                  ...prev,
                                  [d.id]: {
                                    qtyActual: prev[d.id]?.qtyActual ?? d.qtyActual,
                                    reason: e.target.value,
                                  },
                                }))
                              }
                              className="h-8 text-xs rounded-lg"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-outline">Chưa có đợt kiểm kê nào</div>
          )}
        </section>
      </div>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcodeScan}
      />
    </AppShell>
  );
}
