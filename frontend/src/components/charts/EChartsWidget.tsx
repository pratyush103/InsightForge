import React, { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { AlertCircle, BarChart3, Code2, Filter, Maximize2 } from 'lucide-react';
import type { ChartArchetype, DashboardWidgetSpec } from '../../types/insightforge';
import { useDashboardStore } from '../../store/useDashboardStore';
import { ensureWorldMapRegistered } from './worldGeoJson';

ensureWorldMapRegistered();

interface Props {
  widget: DashboardWidgetSpec;
  onExpand?: (widget: DashboardWidgetSpec) => void;
}

const QUICK_CHART_TYPES: { id: ChartArchetype; label: string }[] = [
  { id: 'geo_map', label: 'Geo Map' },
  { id: 'area_spline', label: 'Area' },
  { id: 'multi_line', label: 'Line' },
  { id: 'grouped_bar', label: 'Bar' },
  { id: 'stacked_bar', label: 'Stack' },
  { id: 'horizontal_bar', label: 'Rank' },
  { id: 'combo_dual_axis', label: 'Combo' },
  { id: 'donut', label: 'Donut' },
  { id: 'rose', label: 'Rose' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'sankey', label: 'Sankey' },
  { id: 'radar', label: 'Radar' },
  { id: 'treemap', label: 'Treemap' },
  { id: 'scatter', label: 'Scatter' },
];

export const EChartsWidget: React.FC<Props> = ({ widget, onExpand }) => {
  const { crossFilter, setCrossFilter, setEditingWidget, mutateWidget } = useDashboardStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReactECharts | null>(null);

  // Auto-resize ECharts canvas smoothly when react-grid-layout card resizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const instance = chartRef.current?.getEchartsInstance();
      if (instance) {
        instance.resize();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Apply cross-filter highlight or dataset filtering if another widget set a filter
  const effectiveOption = useMemo(() => {
    const baseOpt = widget.echarts_option || {};
    if (!crossFilter || crossFilter.sourceWidgetId === widget.id) {
      return baseOpt;
    }
    // Check if this widget has rows matching the cross-filter column
    if (widget.rows.length > 0 && crossFilter.column in widget.rows[0]) {
      const filteredRows = widget.rows.filter(
        (r) => String(r[crossFilter.column]) === crossFilter.value
      );
      if (filteredRows.length > 0 && widget.x_field && widget.y_fields.length > 0) {
        const cloned = JSON.parse(JSON.stringify(baseOpt));
        const xCol = widget.x_field;
        const primaryY = widget.y_fields[0];
        if (cloned.xAxis && cloned.xAxis.type === 'category') {
          cloned.xAxis.data = filteredRows.map((r) => String(r[xCol] ?? ''));
          if (Array.isArray(cloned.series)) {
            cloned.series = cloned.series.map((s: Record<string, unknown>, idx: number) => {
              const colName = widget.y_fields[idx] || primaryY;
              return {
                ...s,
                data: filteredRows.map((r) => Number(r[colName] ?? 0)),
              };
            });
          }
          return cloned;
        }
      }
    }
    return baseOpt;
  }, [widget, crossFilter]);

  const onChartEvents = useMemo(
    () => ({
      click: (params: { name?: string }) => {
        if (params?.name && widget.x_field) {
          setCrossFilter({
            column: widget.x_field,
            value: String(params.name),
            sourceWidgetId: widget.id,
          });
        }
      },
    }),
    [widget.id, widget.x_field, setCrossFilter]
  );

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col justify-between p-4 select-none group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800/70">
        <div className="min-w-0">
          <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-100 truncate group-hover:text-indigo-300 transition">
              {widget.title}
            </h3>
            {widget.anomalies.length > 0 && (
              <span
                title={`${widget.anomalies.length} statistical outlier(s) detected (|Z| >= 1.75)`}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-300 shrink-0"
              >
                <AlertCircle className="h-3 w-3" />
                {widget.anomalies.length} Outlier{widget.anomalies.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate">{widget.subtitle || widget.insight_summary}</p>
        </div>

        {/* Widget Toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          <select
            value={widget.chart_type}
            onChange={(e) => mutateWidget(widget, { newChartType: e.target.value as ChartArchetype })}
            aria-label="Switch chart type"
            className="rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            {QUICK_CHART_TYPES.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setEditingWidget(widget)}
            title="Inspect SQL & Lineage Hash"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-indigo-300 transition"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>

          {onExpand && (
            <button
              onClick={() => onExpand(widget)}
              title="Fullscreen Chart"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ECharts Canvas */}
      <div className="flex-1 min-h-0 w-full py-1">
        <ReactECharts
          ref={chartRef}
          option={effectiveOption}
          notMerge={true}
          lazyUpdate={true}
          onEvents={onChartEvents}
          style={{ height: '100%', width: '100%' }}
        />
      </div>

      {/* Footer Insight & Lineage Bar */}
      <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="truncate flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3 text-indigo-400 shrink-0" />
          {widget.insight_summary || `Click any ${widget.x_field || 'point'} to cross-filter dashboard`}
        </span>
        <span className="font-mono text-[10px] text-slate-500 shrink-0 flex items-center gap-1">
          <Filter className="h-2.5 w-2.5" />
          {widget.data_hash.slice(0, 13)}
        </span>
      </div>
    </div>
  );
};
