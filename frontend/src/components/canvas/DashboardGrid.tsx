import React, { useEffect, useRef, useState } from 'react';
import { Responsive } from 'react-grid-layout';
import ReactECharts from 'echarts-for-react';
import { X } from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { DashboardWidgetSpec, GridCoordinates } from '../../types/insightforge';
import { KpiCardWidget } from '../charts/KpiCardWidget';
import { EChartsWidget } from '../charts/EChartsWidget';
import { DataTableWidget } from '../charts/DataTableWidget';

export const DashboardGrid: React.FC = () => {
  const { manifest, layouts, updateLayouts } = useDashboardStore();
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
    <div ref={wrapperRef} className="w-full">
      <Responsive
        className="layout"
        width={containerWidth}
        layouts={layouts}
        breakpoints={{ lg: 1100, md: 768, sm: 0 }}
        cols={{ lg: 12, md: 8, sm: 4 }}
        rowHeight={38}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        draggableHandle=".drag-handle"
        onLayoutChange={(_current, allLayouts) => {
          updateLayouts(allLayouts as unknown as Record<string, GridCoordinates[]>);
        }}
      >
        {manifest.widgets.map((widget) => (
          <div
            key={widget.id}
            className="rounded-2xl border border-slate-800/90 bg-slate-900/75 backdrop-blur-md shadow-xl hover:border-slate-700/90 transition-colors overflow-hidden"
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

      {/* Fullscreen Chart Modal */}
      {expandedWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6">
          <div className="w-full max-w-6xl h-[82vh] rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{expandedWidget.title}</h2>
                <p className="text-xs text-slate-400">
                  {expandedWidget.subtitle || expandedWidget.insight_summary}
                </p>
              </div>
              <button
                onClick={() => setExpandedWidget(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 py-4">
              {expandedWidget.echarts_option && (
                <ReactECharts
                  option={expandedWidget.echarts_option}
                  style={{ height: '100%', width: '100%' }}
                />
              )}
            </div>

            <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="truncate">{expandedWidget.sql_query}</span>
              <span className="text-indigo-400 shrink-0 ml-4">{expandedWidget.data_hash}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
