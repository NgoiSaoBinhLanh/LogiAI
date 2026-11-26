'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { Checkbox } from '@/components/ui/checkbox';
import { ApiError } from '@/services/api';
import { AiApi } from '@/services/operations.service';
import { AiTransferSuggestionItem } from '@/types/operations';

export default function AiTransferOptimizationPage() {
  const [algorithm, setAlgorithm] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [suggestions, setSuggestions] = useState<AiTransferSuggestionItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [editedQty, setEditedQty] = useState<Record<string, number>>({});
  const [onlySave10, setOnlySave10] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ALL' | 'URGENT' | 'COST_OPT' | 'REBALANCE'>('ALL');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AiApi.getTransferSuggestions(onlySave10 ? 10 : 0);
      setAlgorithm(res.algorithm);
      setGeneratedAt(res.generatedAt);
      setSuggestions(res.suggestions);
      const qMap: Record<string, number> = {};
      for (const s of res.suggestions) {
        qMap[s.suggestionKey] = s.recommendedQty;
      }
      setEditedQty(qMap);
      setSelectedKeys(res.suggestions.map((s) => s.suggestionKey));
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể chạy thuật toán tối ưu');
    } finally {
      setLoading(false);
    }
  }, [onlySave10]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const visible = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return suggestions.filter((s) => {
      const matchTab = tab === 'ALL' ? true : s.priority === tab;
      const matchKw =
        !kw ||
        s.sku.toLowerCase().includes(kw) ||
        s.productName.toLowerCase().includes(kw) ||
        s.sourceBranchCode.toLowerCase().includes(kw) ||
        s.destBranchCode.toLowerCase().includes(kw);
      return matchTab && matchKw;
    });
  }, [suggestions, tab, search]);

  const selectedItems = useMemo(
    () => suggestions.filter((s) => selectedKeys.includes(s.suggestionKey)),
    [suggestions, selectedKeys]
  );

  const totalCost = selectedItems.reduce((acc, s) => acc + s.estimatedCostVnd, 0);
  const avgSaving =
    selectedItems.length > 0
      ? Math.round(selectedItems.reduce((acc, s) => acc + s.savingPct, 0) / selectedItems.length)
      : 0;
  const urgentCount = suggestions.filter((s) => s.priority === 'URGENT').length;

  const handleAcceptAll = async () => {
    if (selectedItems.length === 0) {
      toast.error('Chưa chọn đề xuất điều chuyển nào');
      return;
    }
    setSubmitting(true);
    try {
      const res = await AiApi.acceptSuggestions(
        selectedItems.map((s) => ({
          sourceBranchId: s.sourceBranchId,
          destBranchId: s.destBranchId,
          productId: s.productId,
          qty: editedQty[s.suggestionKey] ?? s.recommendedQty,
          confidencePct: s.confidencePct,
        }))
      );
      toast.success(
        `Đã khởi tạo ${res.count} phiếu điều chuyển: ${res.createdCodes.join(', ')}`
      );
      await loadSuggestions();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Khởi tạo phiếu thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      {/* Full-bleed Sub-header Strip (DeXUatDieuChuyenToiUuBangAI.html) */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-primary-fixed text-primary text-[11px] font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
              AI Route &amp; Inventory Solver
            </span>
            <span className="text-label-md font-semibold text-primary">
              {algorithm || 'LOGAI Distance Matrix Solver'}
            </span>
            <span className="text-body-sm text-outline font-mono">
              · Cập nhật: {generatedAt ? new Date(generatedAt).toLocaleTimeString('vi-VN') : '—'}
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Ghép cặp kho dư → kho thiếu đa vùng &amp; minh bạch hóa giải thích quyết định (Decision
            Explainability PB20)
          </p>
        </div>

        <button
          type="button"
          onClick={loadSuggestions}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-2 text-label-md font-semibold shadow-sm transition-colors self-start md:self-auto"
        >
          <span
            className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}
          >
            auto_mode
          </span>
          <span>Chạy lại AI Optimizer</span>
        </button>
      </div>

      <div className="space-y-6 pb-24">
        {/* Top AI Impact Gradient Panel (DeXUatDieuChuyenToiUuBangAI.html) */}
        <section className="rounded-xl bg-gradient-to-r from-surface-container-low via-surface-container to-surface-container-high p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-label-md font-bold uppercase tracking-wider text-primary">
              <span className="material-symbols-outlined text-[18px]">insights</span>
              Tác động tối ưu mạng lưới (AI Recommendation Impact)
            </div>
            <span className="px-3 py-1 rounded-full bg-surface-container-lowest text-primary font-mono text-label-sm font-bold shadow-xs">
              Đã chọn: {selectedItems.length} / {suggestions.length} tuyến
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between text-on-surface-variant text-label-sm font-bold uppercase">
                <span>Số tuyến điều chuyển</span>
                <span className="material-symbols-outlined text-primary text-[18px]">
                  local_shipping
                </span>
              </div>
              <div className="text-headline-md font-mono font-bold text-on-surface mt-2">
                {selectedItems.length} tuyến
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-container mt-3 overflow-hidden">
                <div
                  className="h-full bg-primary-container rounded-full"
                  style={{
                    width: `${
                      suggestions.length > 0
                        ? Math.round((selectedItems.length / suggestions.length) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between text-on-surface-variant text-label-sm font-bold uppercase">
                <span>Mức tiết kiệm ước tính</span>
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                  savings
                </span>
              </div>
              <div className="text-headline-md font-mono font-bold text-emerald-700 mt-2">
                ~{avgSaving}%
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-container mt-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, avgSaving)}%` }}
                />
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between text-on-surface-variant text-label-sm font-bold uppercase">
                <span>Tổng cước dự kiến</span>
                <span className="material-symbols-outlined text-amber-600 text-[18px]">
                  format_image_left
                </span>
              </div>
              <div className="text-headline-md font-mono font-bold text-on-surface mt-2">
                {totalCost.toLocaleString('vi-VN')} đ
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-container mt-3 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full w-2/3" />
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between text-on-surface-variant text-label-sm font-bold uppercase">
                <span>Tuyến Khẩn cấp (Urgent)</span>
                <span className="material-symbols-outlined text-error text-[18px]">
                  swap_driving_apps_wheel
                </span>
              </div>
              <div className="text-headline-md font-mono font-bold text-error mt-2">
                {urgentCount} tuyến
              </div>
              <div className="text-body-sm text-on-surface-variant mt-2">
                Giảm rủi ro đứt hàng tức thì
              </div>
            </div>
          </div>
        </section>

        {/* Main Transfer Suggestions Table Card */}
        <section className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
          {/* Toolbar & Filters */}
          <div className="p-5 bg-surface-container-low/50 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[230px]">
                <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Tìm SKU, mã kho..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 rounded-lg bg-surface-container-lowest pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline shadow-[0_0_0_1px_#c4c5d7] focus:shadow-[0_0_0_2px_#0037b0] focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-label-md font-medium text-on-surface cursor-pointer select-none">
                <Checkbox checked={onlySave10} onCheckedChange={(c) => setOnlySave10(c === true)} />
                <span>Chỉ hiện tiết kiệm &gt; 10%</span>
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedKeys(suggestions.map((s) => s.suggestionKey))}
                  className="px-2.5 py-1 rounded bg-surface-container-lowest hover:bg-surface-container text-label-sm font-semibold text-primary shadow-xs"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKeys([])}
                  className="px-2.5 py-1 rounded bg-surface-container-lowest hover:bg-surface-container text-label-sm font-semibold text-on-surface-variant shadow-xs"
                >
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedKeys(
                      suggestions
                        .filter((s) => s.priority === 'URGENT')
                        .map((s) => s.suggestionKey)
                    )
                  }
                  className="px-2.5 py-1 rounded bg-error-container/70 hover:bg-error-container text-label-sm font-semibold text-on-error-container"
                >
                  Chỉ chọn Khẩn cấp
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'URGENT', label: 'Khẩn cấp' },
                  { id: 'COST_OPT', label: 'Tối ưu chi phí' },
                  { id: 'REBALANCE', label: 'Cân bằng định kỳ' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-full px-3.5 py-1.5 text-label-md font-semibold transition-colors ${
                    tab === t.id
                      ? 'bg-primary-container text-white shadow-sm'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                  <th className="py-3 pl-5 pr-2 font-semibold w-12">Chọn</th>
                  <th className="py-3 px-3 font-semibold">Tuyến điều chuyển</th>
                  <th className="py-3 px-3 font-semibold">Mặt hàng (SKU)</th>
                  <th className="py-3 px-3 font-semibold">SL chuyển</th>
                  <th className="py-3 px-3 font-semibold">Cước &amp; Tiết kiệm</th>
                  <th className="py-3 pl-3 pr-5 font-semibold">Decision Explainability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-body-sm">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-outline">
                      Mạng lưới tồn kho đang cân bằng — chưa phát hiện cặp chênh lệch cần điều phối.
                    </td>
                  </tr>
                ) : (
                  visible.map((s) => {
                    const checked = selectedKeys.includes(s.suggestionKey);
                    return (
                      <tr
                        key={s.suggestionKey}
                        className={`transition-colors ${
                          checked ? 'bg-primary-fixed/15' : 'hover:bg-surface-container-low/40'
                        }`}
                      >
                        <td className="py-3.5 pl-5 pr-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) =>
                              setSelectedKeys((prev) =>
                                c === true
                                  ? [...prev, s.suggestionKey]
                                  : prev.filter((k) => k !== s.suggestionKey)
                              )
                            }
                          />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 font-mono font-bold text-xs">
                            <span className="rounded bg-[#ECFDF5] px-2 py-0.5 text-emerald-700">
                              {s.sourceBranchCode}
                            </span>
                            <span className="material-symbols-outlined text-primary text-[16px]">
                              arrow_forward
                            </span>
                            <span className="rounded bg-error-container/70 px-2 py-0.5 text-on-error-container">
                              {s.destBranchCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-outline mt-1 flex items-center gap-1">
                            <span>{s.distanceKm} km</span>
                            {s.priority === 'URGENT' && (
                              <span className="px-1.5 py-0.2 rounded bg-error-container text-on-error-container font-bold text-[10px]">
                                KHẨN
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-mono font-bold text-xs text-primary">{s.sku}</div>
                          <div className="text-xs text-on-surface font-medium mt-0.5">
                            {s.productName}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <input
                            type="number"
                            min={1}
                            max={s.sourceAvailable}
                            value={editedQty[s.suggestionKey] ?? s.recommendedQty}
                            onChange={(e) =>
                              setEditedQty((prev) => ({
                                ...prev,
                                [s.suggestionKey]: Math.max(
                                  1,
                                  parseInt(e.target.value || '1', 10)
                                ),
                              }))
                            }
                            className="w-24 h-8 rounded-lg bg-surface-container-low text-center font-mono font-bold text-primary shadow-[0_0_0_1px_#c4c5d7] focus:shadow-[0_0_0_2px_#0037b0] focus:outline-none"
                          />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-mono font-bold text-on-surface">
                            {s.estimatedCostVnd.toLocaleString('vi-VN')} đ
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-[10px] font-bold mt-1">
                            Tiết kiệm {s.savingPct}% · AI {s.confidencePct}%
                          </span>
                        </td>
                        <td className="py-3.5 pl-3 pr-5 max-w-xs">
                          <div className="rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-primary text-[15px] shrink-0 mt-0.5">
                              psychology
                            </span>
                            <span>{s.reason}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Fixed Sticky Bottom Action Bar matching DeXUatDieuChuyenToiUuBangAI.html */}
      <div className="fixed bottom-0 left-0 lg:left-[260px] right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-body-sm">
          <div>
            <span className="text-outline">Đã chọn:</span>{' '}
            <strong className="font-mono text-primary font-bold">
              {selectedItems.length} tuyến
            </strong>
          </div>
          <div className="hidden sm:block">
            <span className="text-outline">Tổng cước ước tính:</span>{' '}
            <strong className="font-mono text-on-surface font-bold">
              {totalCost.toLocaleString('vi-VN')} đ
            </strong>
          </div>
          <div className="hidden md:block">
            <span className="text-outline">Tiết kiệm trung bình:</span>{' '}
            <strong className="font-mono text-emerald-700 font-bold">~{avgSaving}%</strong>
          </div>
        </div>

        <button
          type="button"
          disabled={selectedItems.length === 0 || submitting}
          onClick={handleAcceptAll}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-container hover:bg-primary disabled:opacity-50 text-white px-5 py-2.5 text-label-md font-bold shadow-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>
            {submitting
              ? 'Đang khởi tạo...'
              : `Xác nhận & Khởi tạo (${selectedItems.length} phiếu)`}
          </span>
        </button>
      </div>
    </AppShell>
  );
}
