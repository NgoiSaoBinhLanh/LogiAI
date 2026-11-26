'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useRealtime } from '@/store/realtime-context';

export default function AlertsCenterPage() {
  const { alerts, unresolvedRed, unresolvedYellow, triggerScan, resolveAlert, connected } =
    useRealtime();
  const [filterColor, setFilterColor] = useState<'ALL' | 'RED' | 'YELLOW'>('ALL');
  const [scanning, setScanning] = useState(false);

  const visible = alerts.filter((a) =>
    filterColor === 'ALL' ? true : a.colorLevel === filterColor
  );

  const handleRunScan = async () => {
    setScanning(true);
    try {
      await triggerScan();
    } finally {
      setScanning(false);
    }
  };

  return (
    <AppShell>
      {/* Full-bleed Sub-header Context Strip */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-label-md text-outline">
            <span>Tổng quan &amp; AI</span>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="text-primary font-semibold">
              Trung tâm Cảnh báo Realtime &amp; Background Jobs
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Tổng hợp cảnh báo phân cấp Đỏ / Vàng từ 3 tác vụ quét định kỳ (PB19, PB12, PB14)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              connected
                ? 'bg-[#ECFDF5] text-[#10B981]'
                : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            WebSocket: {connected ? 'Connected' : 'Disconnected'}
          </span>
          <button
            type="button"
            onClick={handleRunScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary disabled:opacity-50 text-white px-4 py-2 text-label-md font-semibold shadow-sm transition-colors"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${scanning ? 'animate-spin' : ''}`}
            >
              play_arrow
            </span>
            <span>{scanning ? 'Đang quét...' : 'Chạy quét PB19 / PB12 / PB14 ngay'}</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-[#FEF2F2] rounded-xl p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] border-l-4 border-error">
            <div className="flex items-center gap-2 text-label-md font-bold text-error">
              <span className="material-symbols-outlined text-[19px]">gpp_maybe</span>
              <span>Mức Đỏ (Nguy cấp / Quá hạn SLA)</span>
            </div>
            <p className="text-headline-lg font-mono font-bold text-error mt-2">{unresolvedRed}</p>
          </div>

          <div className="bg-[#FFFBEB] rounded-xl p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] border-l-4 border-amber-500">
            <div className="flex items-center gap-2 text-label-md font-bold text-amber-800">
              <span className="material-symbols-outlined text-[19px]">warning</span>
              <span>Mức Vàng (Cảnh báo sớm / Tồn ứ)</span>
            </div>
            <p className="text-headline-lg font-mono font-bold text-amber-700 mt-2">
              {unresolvedYellow}
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between">
            <div>
              <div className="text-label-md font-bold text-on-surface">
                Lịch Quét Tự Động (node-cron)
              </div>
              <div className="text-xs text-outline mt-1">
                PB19: mỗi 5 phút · PB12: mỗi 1 phút · PB14: mỗi 2 phút
              </div>
            </div>
            <span className="inline-flex w-fit mt-3 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-[11px] font-bold">
              3 Cron Jobs Active
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['ALL', 'RED', 'YELLOW'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilterColor(c)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                filterColor === c
                  ? 'bg-primary-container text-white shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low shadow-xs'
              }`}
            >
              {c === 'ALL'
                ? `Tất cả (${alerts.length})`
                : c === 'RED'
                  ? `Cảnh báo Đỏ (${unresolvedRed})`
                  : `Cảnh báo Vàng (${unresolvedYellow})`}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {visible.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl p-10 text-center text-body-sm text-outline shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              Hiện không có cảnh báo nào chưa xử lý.
            </div>
          ) : (
            visible.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] border-l-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                  a.colorLevel === 'RED'
                    ? 'border-l-error bg-[#FEF2F2]/75'
                    : 'border-l-amber-500 bg-[#FFFBEB]/75'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        a.colorLevel === 'RED'
                          ? 'bg-error text-white'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {a.colorLevel === 'RED' ? 'ĐỎ - NGUY CẤP' : 'VÀNG - CẢNH BÁO'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-[10px] font-mono font-bold text-on-surface">
                      {a.alertType}
                    </span>
                    {a.branch && (
                      <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-mono text-[10px] font-bold">
                        {a.branch.code}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-on-surface text-sm">{a.title}</p>
                  <p className="text-xs text-on-surface-variant">{a.message}</p>
                  <p className="text-[11px] font-mono text-outline">
                    Phát hiện lúc: {new Date(a.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resolveAlert(a.id)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-surface-container-lowest hover:bg-[#ECFDF5] text-emerald-700 px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Đánh dấu đã xử lý</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
