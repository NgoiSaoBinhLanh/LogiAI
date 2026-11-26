'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type * as echarts from 'echarts';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/services/api';
import { AiApi, BranchOpsApi, ProductApi } from '@/services/operations.service';
import { AiForecastResponse, BranchDetailItem, ProductItem } from '@/types/operations';
import { useRealtime } from '@/store/realtime-context';

const EChartBox = dynamic(
  () => import('@/components/charts/echarts-box').then((m) => m.EChartBox),
  {
    ssr: false,
    loading: () => (
      <div className="h-[350px] w-full animate-pulse rounded-xl bg-surface-container-low" />
    ),
  }
);

export default function AiForecastPage() {
  const { alerts, triggerScan, resolveAlert } = useRealtime();
  const [branches, setBranches] = useState<BranchDetailItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);

  const [branchId, setBranchId] = useState('');
  const [productId, setProductId] = useState('');
  const [horizonDays, setHorizonDays] = useState<7 | 14 | 30>(14);
  const [forecast, setForecast] = useState<AiForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([BranchOpsApi.list(), ProductApi.list({ limit: 100 })])
      .then(([bRes, pRes]) => {
        setBranches(bRes.branches);
        setProducts(pRes.items);
        if (bRes.branches[0]) setBranchId(bRes.branches[0].id);
        if (pRes.items[0]) setProductId(pRes.items[0].id);
      })
      .catch(() => {});
  }, []);

  const loadForecast = useCallback(async () => {
    if (!branchId || !productId) return;
    setLoading(true);
    try {
      const res = await AiApi.getForecast(branchId, productId, horizonDays);
      setForecast(res);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể chạy mô hình dự báo AI');
    } finally {
      setLoading(false);
    }
  }, [branchId, productId, horizonDays]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  const handleRefreshAi = async () => {
    await Promise.all([loadForecast(), triggerScan()]);
  };

  const forecastChartOption = useMemo<echarts.EChartsOption>(() => {
    if (!forecast) return {};

    const hist = forecast.historySeries;
    const fc = forecast.forecastSeries;

    const xLabels = [...hist.map((h) => h.date), ...fc.map((f) => f.date)];
    const nullHistPad = new Array<number | null>(Math.max(0, hist.length - 1)).fill(null);
    const lastHistVal = hist[hist.length - 1]?.actual ?? 0;

    const lowerBaseData: Array<number | null> = [
      ...nullHistPad,
      lastHistVal,
      ...fc.map((f) => f.min),
    ];
    const bandWidthData: Array<number | null> = [
      ...nullHistPad,
      0,
      ...fc.map((f) => Math.max(0, f.max - f.min)),
    ];
    const expectedLineData: Array<number | null> = [
      ...nullHistPad,
      lastHistVal,
      ...fc.map((f) => f.expected),
    ];
    const actualLineData: Array<number | null> = [
      ...hist.map((h) => h.actual),
      ...new Array<number | null>(fc.length).fill(null),
    ];

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const arr = params as Array<{
            axisValue: string;
            seriesName: string;
            data: number | null;
          }>;
          const dateLabel = arr[0]?.axisValue || '';
          const idx = xLabels.indexOf(dateLabel);
          if (idx >= hist.length) {
            const fItem = fc[idx - hist.length];
            if (fItem) {
              return `<b>Ngày ${dateLabel} (Dự báo AI)</b><br/>
                Kỳ vọng (Expected): <b>${fItem.expected}</b><br/>
                Khoảng tin cậy 95%: <b>${fItem.min} – ${fItem.max}</b>`;
            }
          }
          const actualPt = arr.find((a) => a.seriesName === 'Bán thực tế lịch sử');
          return `<b>Ngày ${dateLabel} (Lịch sử)</b><br/>Số lượng xuất bán: <b>${actualPt?.data ?? 0}</b>`;
        },
      },
      legend: {
        data: ['Bán thực tế lịch sử', 'Dự báo AI (Expected)', 'Khoảng tin cậy 95% (Min–Max)'],
        bottom: 0,
      },
      grid: { left: 45, right: 25, top: 25, bottom: 45 },
      xAxis: { type: 'category', data: xLabels, boundaryGap: false },
      yAxis: { type: 'value', name: forecast.product.unit },
      series: [
        {
          name: 'L-Base',
          type: 'line',
          stack: 'confidence-band',
          data: lowerBaseData,
          lineStyle: { opacity: 0 },
          symbol: 'none',
          silent: true,
        },
        {
          name: 'Khoảng tin cậy 95% (Min–Max)',
          type: 'line',
          stack: 'confidence-band',
          data: bandWidthData,
          lineStyle: { opacity: 0 },
          areaStyle: { color: 'rgba(29, 78, 216, 0.16)' },
          symbol: 'none',
        },
        {
          name: 'Bán thực tế lịch sử',
          type: 'line',
          smooth: true,
          data: actualLineData,
          itemStyle: { color: '#0b1c30' },
          lineStyle: { width: 2.5 },
        },
        {
          name: 'Dự báo AI (Expected)',
          type: 'line',
          smooth: true,
          data: expectedLineData,
          itemStyle: { color: '#1d4ed8' },
          lineStyle: { width: 2.5, type: 'dashed' },
          markLine: {
            silent: true,
            data: [
              {
                yAxis: forecast.metrics.safetyStock,
                name: 'Tồn an toàn (Min)',
                lineStyle: { color: '#ba1a1a', type: 'dotted' },
                label: { formatter: 'Min Stock: {c}' },
              },
            ],
          },
        },
      ],
    };
  }, [forecast]);

  const activeBranch = branches.find((b) => b.id === branchId);

  return (
    <AppShell>
      {/* Full-bleed Sub-header Context Strip (Branch AI dashboard.html) */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-primary-fixed px-3 py-1 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-label-md text-primary font-semibold">
              AI Branch Node — Live Sync
            </span>
          </div>
          <div className="text-label-md text-on-surface-variant flex items-center gap-1.5">
            <span>Branch Telemetry</span>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="font-semibold text-on-surface">
              {activeBranch ? `${activeBranch.code} - ${activeBranch.name}` : 'Tất cả Chi nhánh'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefreshAi}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-surface-container-low hover:bg-surface-container text-primary px-4 py-2 rounded-lg text-label-md font-semibold transition-colors"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}
            >
              sync
            </span>
            <span>Làm mới AI</span>
            <span className="text-[11px] bg-primary-fixed px-1.5 py-0.5 rounded font-mono font-bold text-primary">
              8ms
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-6 pb-8">
        {/* SECTION 1: Top 4 Horizontal Alert Strip Cards (Branch AI dashboard.html) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-headline-sm font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-[20px]">
                notifications_active
              </span>
              Cảnh báo Khẩn cấp Chi nhánh &amp; Tồn kho Sớm (PB19)
            </h2>
            <Link
              href="/alerts"
              prefetch={false}
              className="text-label-md text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>Xem tất cả cảnh báo ({alerts.length})</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {alerts.slice(0, 4).map((a, idx) => {
              const isRed = a.colorLevel === 'RED';
              const topBarClass = isRed
                ? 'bg-error'
                : idx === 1
                  ? 'bg-amber-500'
                  : idx === 2
                    ? 'bg-primary-container'
                    : 'bg-tertiary';
              const iconName = isRed ? 'dangerous' : idx === 2 ? 'trending_up' : 'inventory_2';

              return (
                <div
                  key={a.id}
                  className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between relative overflow-hidden"
                >
                  <div className={`h-1 w-full ${topBarClass} absolute top-0 left-0`} />
                  <div>
                    <div className="flex items-center justify-between mt-1 mb-2">
                      <span
                        className={`text-label-sm font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1 ${
                          isRed
                            ? 'bg-error-container text-on-error-container'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">{iconName}</span>
                        {isRed ? 'Nguy cấp' : 'Cảnh báo'}
                      </span>
                      <button
                        type="button"
                        onClick={() => resolveAlert(a.id)}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        Đã xử lý
                      </button>
                    </div>
                    <h3 className="text-headline-sm font-bold text-on-surface line-clamp-1">
                      {a.title}
                    </h3>
                    <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">
                      {a.message}
                    </p>
                  </div>
                </div>
              );
            })}

            {alerts.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-4 bg-surface-container-lowest rounded-xl p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-emerald-600 text-[22px]">
                  check_circle
                </span>
                <span className="text-body-md font-medium">
                  Không phát hiện cảnh báo tồn kho thấp hoặc cận hạn nào ở thời điểm hiện tại.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2: AI Forecast 8/4 Split Card */}
        <section className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-5">
          {/* Header & Filter Controls */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-surface-container-low">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  model_training
                </span>
              </div>
              <div>
                <h2 className="text-headline-md font-bold text-on-surface">
                  Dự báo Nhu cầu Đa biến (Time-series AI)
                </h2>
                <p className="text-body-sm text-on-surface-variant">
                  Phân tích chuỗi thời gian kèm dải khoảng tin cậy 95% (Min – Expected – Max)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-48">
                <Select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
                />
              </div>
              <div className="w-64">
                <Select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
                />
              </div>
              <div className="inline-flex bg-surface-container-low p-1 rounded-lg">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setHorizonDays(days)}
                    className={`px-3 py-1.5 text-label-md rounded-md font-semibold transition-all ${
                      horizonDays === days
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {days} ngày
                  </button>
                ))}
              </div>
            </div>
          </div>

          {forecast?.warningMessage && (
            <div className="rounded-lg bg-surface-container-low px-4 py-3 text-body-sm text-on-primary-fixed flex items-start gap-2.5">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                info
              </span>
              <span>{forecast.warningMessage}</span>
            </div>
          )}

          {/* 8 / 4 Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left 8 Cols: Chart */}
            <div className="xl:col-span-8 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-label-lg font-bold text-on-surface">
                  Nhu cầu {horizonDays} ngày tới —{' '}
                  <span className="font-mono text-primary">{forecast?.product.sku || '...'}</span>
                </span>
                {forecast && (
                  <span className="px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#10B981] text-label-sm font-bold">
                    MAPE Độ chuẩn xác: {forecast.metrics.mapeAccuracyPct}%
                  </span>
                )}
              </div>
              <EChartBox option={forecastChartOption} height={350} />
            </div>

            {/* Right 4 Cols: AI Restock Recommendation Panel (Branch AI dashboard.html) */}
            <div className="xl:col-span-4 bg-surface-container-low rounded-xl p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-label-sm font-bold uppercase tracking-wider text-primary">
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  ĐỀ XUẤT NHẬP HÀNG TỰ ĐỘNG
                </span>
                <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-mono text-[10px] font-bold">
                  REC-AI
                </span>
              </div>

              <div>
                <p className="text-body-sm text-on-surface-variant">Đề xuất nhập bổ sung tối ưu</p>
                <div className="text-headline-xl font-mono font-bold text-primary mt-1">
                  +{forecast?.metrics.recommendedRestockQty ?? 0}{' '}
                  <span className="text-base font-semibold text-on-surface">
                    {forecast?.product.unit || 'ĐV'}
                  </span>
                </div>
              </div>

              {/* 3 Mini Metric Cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-container-lowest rounded-lg p-2.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">
                    warehouse
                  </span>
                  <div className="text-sm font-mono font-bold text-on-surface mt-1">
                    {forecast?.metrics.currentAvailable ?? 0}
                  </div>
                  <div className="text-[10px] text-outline">Tồn khả dụng</div>
                </div>
                <div className="bg-surface-container-lowest rounded-lg p-2.5">
                  <span className="material-symbols-outlined text-amber-600 text-[16px]">
                    schedule
                  </span>
                  <div className="text-sm font-mono font-bold text-on-surface mt-1">
                    {forecast?.metrics.avgDailySales ?? 0}
                  </div>
                  <div className="text-[10px] text-outline">Bán TB/ngày</div>
                </div>
                <div className="bg-surface-container-lowest rounded-lg p-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">
                    savings
                  </span>
                  <div className="text-sm font-mono font-bold text-on-surface mt-1">
                    {forecast?.metrics.totalForecastDemand ?? 0}
                  </div>
                  <div className="text-[10px] text-outline">Cầu {horizonDays}N</div>
                </div>
              </div>

              {/* Confidence Progress Bar */}
              {forecast && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-label-sm font-semibold text-on-surface-variant">
                    <span>AI Confidence Score (MAPE)</span>
                    <span className="font-mono text-primary">
                      {forecast.metrics.mapeAccuracyPct}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-container overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary-container transition-all"
                      style={{ width: `${Math.min(100, forecast.metrics.mapeAccuracyPct)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Primary & Secondary CTAs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <Link
                  href="/inventory/inbound"
                  prefetch={false}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white py-2.5 px-3 text-label-md font-semibold shadow-sm transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">add_box</span>
                  <span>Lập phiếu nhập</span>
                </Link>
                <Link
                  href="/ai/transfer-optimization"
                  prefetch={false}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-primary py-2.5 px-3 text-label-md font-semibold shadow-sm transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">swap_horiz</span>
                  <span>Điều chuyển</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Bottom 3 Telemetry Cards (Branch AI dashboard.html) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-[20px]">sync_alt</span>
            </div>
            <div>
              <div className="text-label-sm text-outline uppercase font-bold">
                Ngưỡng Tồn An Toàn (Min)
              </div>
              <div className="text-headline-sm font-mono font-bold text-on-surface mt-0.5">
                {forecast?.metrics.safetyStock ?? 0} {forecast?.product.unit || 'ĐV'}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#10B981] text-[20px]">
                fact_check
              </span>
            </div>
            <div>
              <div className="text-label-sm text-outline uppercase font-bold">
                Số Điểm Lịch Sử Huấn Luyện
              </div>
              <div className="text-headline-sm font-mono font-bold text-on-surface mt-0.5">
                {forecast?.historySeries.length ?? 0} chu kỳ
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-[20px]">
                precision_manufacturing
              </span>
            </div>
            <div>
              <div className="text-label-sm text-outline uppercase font-bold">
                Chuỗi Dự Báo Horizon
              </div>
              <div className="text-headline-sm font-mono font-bold text-on-surface mt-0.5">
                {horizonDays} ngày (95% CI)
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
