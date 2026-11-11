import React, { useEffect, useRef, useState } from 'react';
import { Responsive } from 'react-grid-layout';
import ReactECharts from 'echarts-for-react';
import { X } from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { DashboardWidgetSpec, GridCoordinates } from '../../types/insightforge';
import { KpiCardWidget } from '../charts/KpiCardWidget';
import { EChartsWidget } from '../charts/EChartsWidget';
import { DataTableWidget } from '../charts/DataTableWidget';
import { applyReportTheme } from '../../lib/reportTheme';

export const DashboardGrid: React.FC = () => {
  const { manifest, layouts, updateLayouts, selectWidget } = useDashboardStore();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1280);
  const [expandedWidget, setExpandedWidget] = useState<DashboardWidgetSpec | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth || 1280);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!manifest) return null;

  return (
    <div
      ref={wrapperRef}
      className="w-full"
      onClick={(e) => {
        // Clicking canvas background deselects active visual
        if (e.target === e.currentTarget) {
          selectWidget(null);
        }
      }}
    >
      <Responsive
        className="layout"
        width={containerWidth}
        layouts={layouts}
        breakpoints={{ lg: 1100, md: 768, sm: 0 }}
        cols={{ lg: 12, md: 8, sm: 4 }}
        rowHeight={36}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        draggableHandle=".drag-handle"
        onLayoutChange={(_current, allLayouts) => {
          updateLayouts(allLayouts as unknown as Record<string, GridCoordinates[]>);
        }}
      >
        {manifest.widgets.map((widget) => (
          <div
            key={widget.id}
            className="rounded border border-line bg-white shadow-sm hover:shadow transition-shadow overflow-hidden"
          >
            {widget.widget_type === 'kpi' ? (
              <KpiCardWidget widget={widget} />
            ) : widget.widget_type === 'table' ? (
              <DataTableWidget widget={widget} />
            ) : (
              <EChartsWidget widget={widget} onExpand={(w) => setExpandedWidget(w)} />
            )}
          </div>
        ))}
      </Responsive>

      {/* Focus Mode (Full-screen Visual Dialog) */}
      {expandedWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
          <div className="w-full max-w-5xl h-[80vh] rounded bg-white border border-line-strong p-5 flex flex-col justify-between shadow-dialog">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">{expandedWidget.title}</h2>
                <p className="text-xs text-muted">
                  {expandedWidget.subtitle || expandedWidget.insight_summary}
                </p>
              </div>
              <button
                onClick={() => setExpandedWidget(null)}
                className="rounded p-1 text-muted hover:bg-hover hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 py-3">
              {expandedWidget.echarts_option && (
                <ReactECharts
                  option={applyReportTheme(expandedWidget.echarts_option)}
                  style={{ height: '100%', width: '100%' }}
                />
              )}
            </div>

            <div className="border-t border-line pt-2.5 flex items-center justify-between text-2xs font-mono text-muted">
              <span className="truncate">{expandedWidget.sql_query}</span>
              <span className="text-focus shrink-0 ml-4 font-bold">{expandedWidget.data_hash}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
