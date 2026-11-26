'use client';

import React, { useEffect, useRef } from 'react';
import type * as echartsType from 'echarts';

type EChartsCoreModule = typeof import('echarts/core');
type EChartsInstance = ReturnType<EChartsCoreModule['init']>;

let echartsCorePromise: Promise<EChartsCoreModule> | null = null;

/**
 * Tree-shaken ECharts loader: chỉ nạp 4 biểu đồ thực tế dùng trong LogiAI
 * (Bar, Line, Pie, Heatmap) thay vì toàn bộ 1.2MB thư viện monolithic.
 */
function loadEchartsCore(): Promise<EChartsCoreModule> {
  if (!echartsCorePromise) {
    echartsCorePromise = Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ]).then(
      ([
        core,
        { BarChart, LineChart, PieChart, HeatmapChart },
        { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, MarkLineComponent },
        { CanvasRenderer },
      ]) => {
        core.use([
          BarChart,
          LineChart,
          PieChart,
          HeatmapChart,
          GridComponent,
          TooltipComponent,
          LegendComponent,
          VisualMapComponent,
          MarkLineComponent,
          CanvasRenderer,
        ]);
        return core;
      }
    );
  }
  return echartsCorePromise;
}

interface EChartBoxProps {
  option: echartsType.EChartsOption;
  height?: number;
  className?: string;
}

export function EChartBox({ option, height = 320, className = '' }: EChartBoxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsInstance | null>(null);
  const latestOptionRef = useRef<echartsType.EChartsOption>(option);
  latestOptionRef.current = option;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let observer: ResizeObserver | null = null;

    loadEchartsCore().then((echarts) => {
      if (cancelled || !containerRef.current) return;
      const instance = echarts.init(containerRef.current);
      chartRef.current = instance;
      instance.setOption(
        latestOptionRef.current as Parameters<EChartsInstance['setOption']>[0],
        { notMerge: true }
      );

      observer = new ResizeObserver(() => {
        instance.resize();
      });
      observer.observe(containerRef.current);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setOption(
        option as Parameters<EChartsInstance['setOption']>[0],
        { notMerge: true }
      );
    }
  }, [option]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px`, width: '100%' }}
      className={className}
    />
  );
}
