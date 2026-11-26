'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type * as echarts from 'echarts';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { ApiError } from '@/services/api';
import { AnalyticsApi } from '@/services/operations.service';
import { AnalyticsKpisResponse } from '@/types/operations';
import { exportToPdf } from '@/lib/export-utils';
import { useAuth } from '@/store/auth-context';

const EChartBox = dynamic(
  () => import('@/components/charts/echarts-box').then((m) => m.EChartBox),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full animate-pulse rounded-xl bg-surface-container-low" />
    ),
  }
);

export default function ExecutiveDashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [data, setData] = useState<AnalyticsKpisResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadKpis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AnalyticsApi.getKpis(period);
      setData(res);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải chỉ số KPI');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  const barChartOption = useMemo<echarts.EChartsOption>(() => {
    const trend = data?.orderTrend ?? [];
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Đơn tiếp nhận', 'Giao thành công', 'Tỷ lệ SLA (%)'], bottom: 0 },
      grid: { left: 45, right: 45, top: 20, bottom: 45 },
      xAxis: { type: 'category', data: trend.map((t) => t.label) },
      yAxis: [
        { type: 'value', name: 'Số đơn' },
        { type: 'value', name: '% SLA', min: 0, max: 100 },
      ],
      series: [
        {
          name: 'Đơn tiếp nhận',
          type: 'bar',
          data: trend.map((t) => t.received),
          itemStyle: { color: '#1d4ed8', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Giao thành công',
          type: 'bar',
          data: trend.map((t) => t.delivered),
          itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Tỷ lệ SLA (%)',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: trend.map((t) => t.slaPct),
          itemStyle: { color: '#f59e0b' },
        },
      ],
    };
  }, [data]);

  const heatmapOption = useMemo<echarts.EChartsOption>(() => {
    const hm = data?.heatmap ?? { branches: [], categories: [], cells: [] };
    return {
      tooltip: {
        position: 'top',
        formatter: (params: unknown) => {
          const p = params as { value: [number, number, number, number] };
          const [cIdx, bIdx, pct, qty] = p.value;
          return `${hm.branches[bIdx] || ''} · ${hm.categories[cIdx] || ''}<br/>Chiếm dụng: <b>${pct}%</b> (${qty} đv)`;
        },
      },
      grid: { height: '65%', top: '8%', left: 80, right: 20 },
      xAxis: {
        type: 'category',
        data: hm.categories,
        splitArea: { show: true },
        axisLabel: { interval: 0, fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: hm.branches,
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '2%',
        inRange: {
          color: ['#ecfdf5', '#fef08a', '#fb923c', '#ef4444'],
        },
      },
      series: [
        {
          name: 'Mật độ tồn kho (%)',
          type: 'heatmap',
          data: hm.cells,
          label: {
            show: true,
            formatter: (params: unknown) => {
              const p = params as { value: [number, number, number, number] };
              return `${p.value[2]}%`;
            },
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.3)' },
          },
        },
      ],
    };
  }, [data]);

  const donutOption = useMemo<echarts.EChartsOption>(() => {
    const dist = data?.branchDistribution ?? [];
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} đ ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [
        {
          name: 'Giá trị tồn kho',
          type: 'pie',
          radius: ['48%', '74%'],
          center: ['50%', '44%'],
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          data: dist.map((d) => ({ name: d.branchCode, value: d.value })),
        },
      ],
    };
  }, [data]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Action & Period Control Ribbon (tong_quan_KPIs.html) */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-label-md text-outline mb-1">
              <span className="material-symbols-outlined text-[16px] text-primary">monitoring</span>
              <span>Dashboard Tổng Quan Chuỗi Cung Ứng (UI02 / PB17)</span>
            </div>
            <p className="text-body-md text-on-surface-variant">
              Xin chào <strong className="text-on-surface font-semibold">{user?.fullName}</strong>{' '}
              — Giám sát chỉ số vốn tồn kho, vòng quay và hiệu suất SLA đa chi nhánh
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-surface-container-low p-1 rounded-lg">
              {(
                [
                  { id: 'week', label: 'Tuần' },
                  { id: 'month', label: 'Tháng' },
                  { id: 'quarter', label: 'Quý' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  className={`px-3.5 py-1.5 text-label-md rounded-md transition-colors ${
                    period === tab.id
                      ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadKpis}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-lowest text-label-md font-semibold text-on-surface hover:bg-surface-container-low shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}
              >
                refresh
              </span>
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              onClick={() =>
                data &&
                exportToPdf(
                  `bao-cao-kpi-${period}`,
                  'BÁO CÁO QUẢN TRỊ CHUỖI CUNG ỨNG LOGAI',
                  ['Chỉ số KPI', 'Giá trị'],
                  [
                    [
                      'Tổng giá trị tồn kho',
                      `${data.kpis.totalInventoryValue.toLocaleString('vi-VN')} VNĐ`,
                    ],
                    ['Tổng số lượng tồn kho', `${data.kpis.totalStockUnits} đơn vị`],
                    ['Vòng quay tồn kho', `${data.kpis.inventoryTurnoverRatio}x`],
                    ['Tỷ lệ hoàn tất SLA', `${data.kpis.slaFulfillmentRate}%`],
                    [
                      'Chi phí điều phối liên kho',
                      `${data.kpis.interBranchTransferCost.toLocaleString('vi-VN')} VNĐ`,
                    ],
                  ]
                )
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-white text-label-md font-semibold shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              <span>Xuất báo cáo PDF</span>
            </button>
          </div>
        </div>

        {/* Row 1: 4 Primary KPI Cards matching tong_quan_KPIs.html */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* KPI Card 1: Total Inventory Value */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between transition-all hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    account_balance_wallet
                  </span>
                </div>
                <span className="text-label-md text-on-surface-variant font-semibold">
                  Tổng Giá Trị Tồn Kho
                </span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl xl:text-[28px] font-bold font-mono text-on-surface tracking-tight">
                {(data?.kpis.totalInventoryValue ?? 0).toLocaleString('vi-VN')} đ
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  Realtime Live
                </span>
                <span className="text-body-sm text-outline">quy đổi toàn chuỗi</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-body-sm bg-surface-container-low/60 -mx-6 -mb-6 px-6 py-2.5 rounded-b-xl">
              <span className="text-on-surface-variant">Tổng đơn vị khả dụng:</span>
              <span className="font-mono font-semibold text-on-surface">
                {(data?.kpis.totalStockUnits ?? 0).toLocaleString('vi-VN')} ĐV
              </span>
            </div>
          </div>

          {/* KPI Card 2: Inventory Turnover */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between transition-all hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    autorenew
                  </span>
                </div>
                <span className="text-label-md text-on-surface-variant font-semibold">
                  Vòng Quay Tồn Kho
                </span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-headline-xl font-mono font-bold text-on-surface tracking-tight">
                {data?.kpis.inventoryTurnoverRatio ?? 0}x
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                  Tối ưu FEFO
                </span>
                <span className="text-body-sm text-outline">quy đổi chu kỳ năm</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-body-sm bg-surface-container-low/60 -mx-6 -mb-6 px-6 py-2.5 rounded-b-xl">
              <span className="text-on-surface-variant">Tốc độ luân chuyển:</span>
              <span className="font-mono font-semibold text-emerald-700">Ổn định</span>
            </div>
          </div>

          {/* KPI Card 3: SLA Fulfillment Rate */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between transition-all hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#10B981] text-[20px]">
                    verified_user
                  </span>
                </div>
                <span className="text-label-md text-on-surface-variant font-semibold">
                  Tỷ Lệ Hoàn Tất SLA
                </span>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#ECFDF5] text-[#10B981] text-[10px] font-bold">
                Mục tiêu 95%
              </span>
            </div>
            <div className="mt-4">
              <div className="text-headline-xl font-mono font-bold text-primary tracking-tight">
                {data?.kpis.slaFulfillmentRate ?? 100}%
              </div>
              <div className="w-full h-2 rounded-full bg-surface-container mt-3 overflow-hidden">
                <div
                  className="h-full bg-primary-container rounded-full transition-all"
                  style={{ width: `${Math.min(100, data?.kpis.slaFulfillmentRate ?? 100)}%` }}
                />
              </div>
            </div>
            <div className="mt-4 pt-3 grid grid-cols-2 gap-2 text-body-sm bg-surface-container-low/60 -mx-6 -mb-6 px-6 py-2.5 rounded-b-xl">
              <div>
                <span className="text-outline">Đã giao đạt:</span>{' '}
                <span className="font-mono font-bold text-[#10B981]">
                  {data?.kpis.fulfilledOrders ?? 0}
                </span>
              </div>
              <div className="text-right">
                <span className="text-outline">Tổng đơn:</span>{' '}
                <span className="font-mono font-bold text-on-surface">
                  {data?.kpis.totalOrders ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* KPI Card 4: Inter-Branch Transfer Cost */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between transition-all hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#FFFBEB] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#F59E0B] text-[20px]">
                    local_shipping
                  </span>
                </div>
                <span className="text-label-md text-on-surface-variant font-semibold">
                  Chi Phí Điều Phối Liên Kho
                </span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl xl:text-[28px] font-bold font-mono text-on-surface tracking-tight">
                {(data?.kpis.interBranchTransferCost ?? 0).toLocaleString('vi-VN')} đ
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  AI Route Solver
                </span>
                <span className="text-body-sm text-outline">tuyến liên kho</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-body-sm bg-surface-container-low/60 -mx-6 -mb-6 px-6 py-2.5 rounded-b-xl">
              <span className="text-on-surface-variant">Tối ưu chi phí:</span>
              <Link
                href="/ai/transfer-optimization"
                prefetch={false}
                className="font-semibold text-primary hover:underline"
              >
                Mở AI Đề xuất →
              </Link>
            </div>
          </div>
        </div>

        {/* Row 2: 7/5 Charts Grid matching tong_quan_KPIs.html */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-headline-sm font-bold text-on-surface">
                  Xu hướng đơn hàng &amp; Tỷ lệ đáp ứng (Bar + Trend)
                </h2>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  Theo dõi lưu lượng đơn tiếp nhận, giao thành công và tỷ lệ đạt chuẩn SLA
                </p>
              </div>
            </div>
            <EChartBox option={barChartOption} height={310} />
          </div>

          <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between">
            <div>
              <h2 className="text-headline-sm font-bold text-on-surface">
                Tỷ trọng tồn kho theo Khu vực / Chi nhánh
              </h2>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                Phân bổ giá trị vốn lưu kho trên toàn mạng lưới
              </p>
            </div>
            <div className="my-2">
              <EChartBox option={donutOption} height={275} />
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low flex items-center gap-2 text-body-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                info
              </span>
              <span>
                Phân bổ vốn kho giúp AI phát hiện vùng dư thừa để điều chuyển liên vùng tối ưu.
              </span>
            </div>
          </div>
        </div>

        {/* Heatmap Panel */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="mb-4">
            <h2 className="text-headline-sm font-bold text-on-surface">
              Biểu Đồ Nhiệt Tồn Kho Toàn Mạng Lưới (Inventory Heatmap)
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Trực quan hóa mật độ chiếm dụng (%) theo từng Chi nhánh × Nhóm ngành hàng
            </p>
          </div>
          <EChartBox option={heatmapOption} height={295} />
        </div>

        {/* Row 3: 50/50 Operational Tables matching tong_quan_KPIs.html */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Top 5 Best Selling */}
          <div className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col">
            <div className="p-6 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-headline-sm font-bold text-on-surface">
                  Top 5 Sản phẩm bán chạy nhất
                </h2>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  Xếp hạng theo sản lượng xuất bán trong kỳ
                </p>
              </div>
              <Link
                href="/products"
                prefetch={false}
                className="text-label-md font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span>Xem tất cả</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
            <div className="overflow-x-auto px-6 pb-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                    <th className="py-2.5 px-3 rounded-l-md font-semibold">Sản phẩm / SKU</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Đã bán</th>
                    <th className="py-2.5 px-3 rounded-r-md font-semibold text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="text-body-sm divide-y divide-surface-container-low">
                  {(data?.topSelling ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-outline">
                        Chưa phát sinh đơn hàng trong kỳ
                      </td>
                    </tr>
                  ) : (
                    data?.topSelling.map((item) => (
                      <tr
                        key={item.sku}
                        className="hover:bg-surface-container-low/50 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-xs text-primary">{item.sku}</div>
                          <div className="font-medium text-on-surface text-xs mt-0.5">
                            {item.name}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-on-surface">
                          {item.qtySold.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">
                          {item.revenue.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Deadstock Overdue Alerts */}
          <div className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col">
            <div className="p-6 pb-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-headline-sm font-bold text-on-surface">
                    Cảnh báo hàng tồn đọng quá hạn
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] text-[10px] font-bold">
                    {data?.deadstock.items.length ?? 0} Lô
                  </span>
                </div>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  Tổng vốn kẹt ước tính:{' '}
                  <strong className="font-mono text-error">
                    {(data?.deadstock.totalStuckCapital ?? 0).toLocaleString('vi-VN')} đ
                  </strong>
                </p>
              </div>
              <Link
                href="/ai/transfer-optimization"
                prefetch={false}
                className="px-3.5 py-1.5 rounded-lg bg-primary-container hover:bg-primary text-white text-label-md font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>Đề xuất luân chuyển AI</span>
              </Link>
            </div>
            <div className="overflow-x-auto px-6 pb-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                    <th className="py-2.5 px-3 rounded-l-md font-semibold">SKU / Kho</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tồn kho</th>
                    <th className="py-2.5 px-3 rounded-r-md font-semibold text-right">Vốn kẹt</th>
                  </tr>
                </thead>
                <tbody className="text-body-sm divide-y divide-surface-container-low">
                  {(data?.deadstock.items ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-outline">
                        Không có lô hàng tồn đọng quá hạn
                      </td>
                    </tr>
                  ) : (
                    data?.deadstock.items.map((d, idx) => (
                      <tr
                        key={d.stockId}
                        className={`transition-colors ${
                          idx === 0
                            ? 'bg-[#FEF2F2]/60 hover:bg-[#FEF2F2]'
                            : 'hover:bg-surface-container-low/50'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-xs text-error">{d.sku}</div>
                          <div className="text-xs text-on-surface-variant mt-0.5">
                            <span className="font-semibold text-on-surface">{d.branchCode}</span> ·{' '}
                            {d.productName}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] font-mono text-xs font-bold">
                            {d.qtyOnHand}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-error">
                          {d.stuckValue.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
