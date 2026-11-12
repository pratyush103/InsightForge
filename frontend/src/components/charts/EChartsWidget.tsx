import React, { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { AlertCircle, Code2, Maximize2 } from 'lucide-react';
import type { ChartArchetype, DashboardWidgetSpec } from '../../types/insightforge';
import { useDashboardStore } from '../../store/useDashboardStore';
import { useProjectStore } from '../../store/useProjectStore';
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
  const { projects, activeProjectId, updateWidgetScope } = useProjectStore();

  const project = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const activePage = useMemo(() => {
    if (!project) return null;
    return (
      project.pages.find((pg) => pg.id === project.activePageId) ||
      project.pages[0] ||
      null
    );
  }, [project]);

  const widgetScope = activePage?.widgetScopes?.[widget.id];

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

  // Apply cross-filter and per-widget scope (zoomEnd / selectedCategory)
  const effectiveOption = useMemo(() => {
    const baseOpt = widget.echarts_option || {};
    if (widget.rows.length === 0) return baseOpt;

    let rowsToRender = [...widget.rows];
    let modified = false;

    // 1. Cross-filter from another widget
    if (
      crossFilter &&
      crossFilter.sourceWidgetId !== widget.id &&
      crossFilter.column in rowsToRender[0]
    ) {
      const cfRows = rowsToRender.filter(
        (r) => String(r[crossFilter.column]) === crossFilter.value
      );
      if (cfRows.length > 0) {
        rowsToRender = cfRows;
        modified = true;
      }
    }

    // 2. Widget-level category scope
    if (widgetScope?.selectedCategory && widget.x_field) {
      const scopedRows = rowsToRender.filter(
        (r) => String(r[widget.x_field!]) === widgetScope.selectedCategory
      );
      if (scopedRows.length > 0) {
        rowsToRender = scopedRows;
        modified = true;
      }
    }

    // 3. Widget-level zoom/window slice
    if (widgetScope?.zoomEnd && widgetScope.zoomEnd < 100 && rowsToRender.length > 1) {
      const count = Math.max(1, Math.ceil((rowsToRender.length * widgetScope.zoomEnd) / 100));
      rowsToRender = rowsToRender.slice(0, count);
      modified = true;
    }

    if (modified && widget.x_field && widget.y_fields.length > 0) {
      const cloned = JSON.parse(JSON.stringify(baseOpt));
      const xCol = widget.x_field;
      const primaryY = widget.y_fields[0];
      if (cloned.xAxis && cloned.xAxis.type === 'category') {
        cloned.xAxis.data = rowsToRender.map((r) => String(r[xCol] ?? ''));
        if (Array.isArray(cloned.series)) {
          cloned.series = cloned.series.map((s: Record<string, unknown>, idx: number) => {
            const colName = widget.y_fields[idx] || primaryY;
            return {
              ...s,
              data: rowsToRender.map((r) => Number(r[colName] ?? 0)),
            };
          });
        }
        return cloned;
      }
    }

    return baseOpt;
  }, [widget, crossFilter, widgetScope]);

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
      datazoom: (params: { start?: number; end?: number }) => {
        if (project && (typeof params.start === 'number' || typeof params.end === 'number')) {
          updateWidgetScope(project.id, widget.id, {
            zoomStart: Math.round(params.start ?? 0),
            zoomEnd: Math.round(params.end ?? 100),
          });
        }
      },
    }),
    [widget.id, widget.x_field, setCrossFilter, project, updateWidgetScope]
  );

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col justify-between p-3.5 select-none group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800/50">
        <div className="min-w-0">
          <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center gap-2">
            <h3 className="text-xs font-medium text-slate-200 truncate group-hover:text-white transition">
              {widget.title}
            </h3>
            {widget.anomalies.length > 0 && (
              <span
                title={`${widget.anomalies.length} statistical outlier(s) detected (|Z| >= 1.75)`}
                className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 text-[10px] font-mono text-amber-300 shrink-0"
              >
                <AlertCircle className="h-2.5 w-2.5" />
                {widget.anomalies.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            {widget.subtitle || widget.insight_summary}
          </p>
        </div>

        {/* Widget Toolbar */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 shrink-0"
        >
          {/* Quick Window Scope Selector */}
          {project && widget.rows.length > 3 && (
            <select
              value={String(widgetScope?.zoomEnd ?? 100)}
              onChange={(e) =>
                updateWidgetScope(project.id, widget.id, {
                  zoomStart: 0,
                  zoomEnd: Number(e.target.value),
                })
              }
              title="Widget data window scope"
              className="rounded border border-slate-800/80 bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 hover:border-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="100">All</option>
              <option value="75">75%</option>
              <option value="50">50%</option>
            </select>
          )}

          <select
            value={widget.chart_type}
            onChange={(e) =>
              mutateWidget(widget, { newChartType: e.target.value as ChartArchetype })
            }
            aria-label="Switch chart type"
            className="rounded border border-slate-800/80 bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 hover:border-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
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
            className="rounded p-1 text-slate-500 hover:bg-slate-800/80 hover:text-slate-200 transition"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>

          {onExpand && (
            <button
              onClick={() => onExpand(widget)}
              title="Fullscreen Chart"
              className="rounded p-1 text-slate-500 hover:bg-slate-800/80 hover:text-slate-200 transition"
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
      <div className="pt-1.5 border-t border-slate-800/50 flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className="truncate">
          {widget.insight_summary ||
            `Click any ${widget.x_field || 'point'} to cross-filter dashboard`}
        </span>
        <span className="font-mono text-slate-500 shrink-0">
          {widget.data_hash.slice(0, 10)}
        </span>
      </div>
    </div>
  );
};
