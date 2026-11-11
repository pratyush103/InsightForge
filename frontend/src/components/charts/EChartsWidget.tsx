import React, { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Code2, Maximize2, TriangleAlert } from 'lucide-react';
import type { DashboardWidgetSpec } from '../../types/insightforge';
import { useDashboardStore } from '../../store/useDashboardStore';
import { applyReportTheme } from '../../lib/reportTheme';
import { ensureWorldMapRegistered } from './worldGeoJson';

ensureWorldMapRegistered();

interface Props {
  widget: DashboardWidgetSpec;
  onExpand?: (widget: DashboardWidgetSpec) => void;
}

export const EChartsWidget: React.FC<Props> = ({ widget, onExpand }) => {
  const { crossFilter, setCrossFilter, setEditingWidget, selectedWidgetId, selectWidget } = useDashboardStore();
  const chartRef = useRef<ReactECharts | null>(null);

  const effectiveOption = useMemo(() => {
    const baseOpt = widget.echarts_option || {};
    let activeOpt = baseOpt;

    // Apply cross-filter if one is set
    if (crossFilter && crossFilter.sourceWidgetId !== widget.id) {
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
            activeOpt = cloned;
          }
        }
      }
    }

    return applyReportTheme(activeOpt);
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

  const isSelected = selectedWidgetId === widget.id;

  return (
    <div
      onClick={() => selectWidget(widget.id)}
      className={`h-full w-full flex flex-col justify-between p-3 select-none bg-white rounded transition-shadow ${
        isSelected ? 'ring-2 ring-focus' : ''
      }`}
    >
      {/* Visual Header */}
      <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-line">
        <div className="min-w-0">
          <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center gap-1.5">
            <h3 className="text-xs font-semibold text-ink truncate">
              {widget.title}
            </h3>
            {widget.anomalies.length > 0 && (
              <span
                title={`${widget.anomalies.length} statistical outlier(s) detected (|Z| >= 1.75)`}
                className="inline-flex items-center gap-1 rounded bg-[#fff9e6] border border-[#c19c00] px-1.5 py-0.2 text-2xs font-mono font-medium text-warn shrink-0"
              >
                <TriangleAlert className="h-3 w-3" />
                {widget.anomalies.length}
              </span>
            )}
          </div>
          <p className="text-2xs text-muted truncate">
            {widget.subtitle || widget.insight_summary}
          </p>
        </div>

        {/* Visual Action Toolbar */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-80 hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingWidget(widget);
            }}
            title="Inspect SQL & Format Visual"
            className="rounded p-1 text-muted hover:bg-hover hover:text-ink transition"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>

          {onExpand && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand(widget);
              }}
              title="Focus Mode (Full Screen)"
              className="rounded p-1 text-muted hover:bg-hover hover:text-ink transition"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
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

      {/* Footer Info */}
      <div className="pt-1 border-t border-line flex items-center justify-between text-2xs text-subtle">
        <span className="truncate">
          {widget.x_field ? `Cross-filter by ${widget.x_field}` : 'Static visual'}
        </span>
        <span className="font-mono tnum shrink-0 ml-2">
          {widget.data_hash.slice(0, 10)}
        </span>
      </div>
    </div>
  );
};
