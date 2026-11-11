import React from 'react';
import {
  BarChart,
  LineChart,
  AreaChart,
  PieChart,
  Table2,
  MapPin,
  Flame,
  GitMerge,
  Radar as RadarIcon,
  ScatterChart,
  LayoutGrid,
  FilterX,
  Code2,
  Calendar,
  KeyRound,
  Hash,
  Type,
  Maximize2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { ChartArchetype } from '../../types/insightforge';

interface VisualTypeIcon {
  id: ChartArchetype;
  label: string;
  icon: React.ReactNode;
}

const VISUAL_TYPES: VisualTypeIcon[] = [
  { id: 'grouped_bar', label: 'Clustered Bar', icon: <BarChart className="h-4 w-4" /> },
  { id: 'stacked_bar', label: 'Stacked Bar', icon: <BarChart className="h-4 w-4" /> },
  { id: 'horizontal_bar', label: 'Horizontal Bar', icon: <BarChart className="h-4 w-4 rotate-90" /> },
  { id: 'multi_line', label: 'Line Chart', icon: <LineChart className="h-4 w-4" /> },
  { id: 'area_spline', label: 'Area Chart', icon: <AreaChart className="h-4 w-4" /> },
  { id: 'combo_dual_axis', label: 'Combo Chart', icon: <BarChart className="h-4 w-4" /> },
  { id: 'donut', label: 'Donut Chart', icon: <PieChart className="h-4 w-4" /> },
  { id: 'rose', label: 'Rose Chart', icon: <PieChart className="h-4 w-4" /> },
  { id: 'kpi', label: 'KPI Card', icon: <Hash className="h-4 w-4" /> },
  { id: 'table', label: 'Table', icon: <Table2 className="h-4 w-4" /> },
  { id: 'geo_map', label: 'Map', icon: <MapPin className="h-4 w-4" /> },
  { id: 'funnel', label: 'Funnel', icon: <FilterX className="h-4 w-4" /> },
  { id: 'heatmap', label: 'Heatmap', icon: <Flame className="h-4 w-4" /> },
  { id: 'sankey', label: 'Sankey Flow', icon: <GitMerge className="h-4 w-4" /> },
  { id: 'radar', label: 'Radar', icon: <RadarIcon className="h-4 w-4" /> },
  { id: 'treemap', label: 'Treemap', icon: <LayoutGrid className="h-4 w-4" /> },
  { id: 'scatter', label: 'Scatter', icon: <ScatterChart className="h-4 w-4" /> },
];

export const PowerBiSidePanes: React.FC = () => {
  const {
    openPanes,
    manifest,
    schemaCatalog,
    selectedWidgetId,
    mutateWidget,
    setEditingWidget,
    crossFilter,
    setCrossFilter,
    runAnalysis,
    openTableInDataView,
  } = useDashboardStore();

  const selectedWidget = manifest?.widgets.find((w) => w.id === selectedWidgetId) || null;

  return (
    <aside
      aria-label="Power BI Tool Panes"
      className="flex h-full border-l border-line bg-white shrink-0 z-10 select-none text-xs"
    >
      {/* 1. Filters & AI Insights Pane */}
      {openPanes.insights && (
        <section aria-label="Filters and Insights" className="w-64 border-r border-line flex flex-col h-full bg-[#faf9f8]">
          <div className="h-9 px-3 border-b border-line flex items-center justify-between font-semibold text-ink bg-white">
            <span>Filters & Insights</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Active Cross Filter Indicator */}
            {crossFilter && (
              <div className="rounded border border-focus/40 bg-focus-tint p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-2xs font-semibold text-focus">
                  <span>Cross-filter Active</span>
                  <button
                    onClick={() => setCrossFilter(null)}
                    className="text-2xs text-focus hover:underline font-bold"
                  >
                    Clear
                  </button>
                </div>
                <div className="text-xs text-ink">
                  <span className="font-medium text-muted">{crossFilter.column}:</span>{' '}
                  <span className="font-semibold">{crossFilter.value}</span>
                </div>
              </div>
            )}

            {/* AI Executive Summary Note */}
            {manifest && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-muted">
                    <Sparkles className="h-3 w-3 text-brand" /> Executive Summary
                  </div>
                  <p className="text-xs text-ink leading-relaxed bg-white border border-line rounded p-2.5">
                    {manifest.executive_summary}
                  </p>
                </div>

                {/* Key Insights Bullet Points */}
                {manifest.key_insights.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-2xs font-bold uppercase tracking-wider text-muted">Key Findings</div>
                    <ul className="space-y-1">
                      {manifest.key_insights.map((ins, i) => (
                        <li
                          key={i}
                          className="text-xs text-ink bg-white border border-line rounded p-2 leading-snug"
                        >
                          • {ins}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested Analytical Questions */}
                {manifest.suggested_followups.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-2xs font-bold uppercase tracking-wider text-muted">Suggested Drilldowns</div>
                    <div className="space-y-1">
                      {manifest.suggested_followups.map((f, i) => (
                        <button
                          key={i}
                          onClick={() => runAnalysis(f)}
                          className="w-full text-left text-xs text-focus bg-white hover:bg-hover border border-line rounded p-2 transition flex items-center justify-between group"
                        >
                          <span className="truncate">{f}</span>
                          <ChevronRight className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!manifest && (
              <div className="text-center py-8 text-muted space-y-1">
                <p className="font-medium">No report loaded</p>
                <p className="text-2xs">Ask a question or get data to inspect filters and insights.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2. Visualizations Pane */}
      {openPanes.visualizations && (
        <section aria-label="Visualizations Pane" className="w-60 border-r border-line flex flex-col h-full bg-[#faf9f8]">
          <div className="h-9 px-3 border-b border-line flex items-center justify-between font-semibold text-ink bg-white">
            <span>Visualizations</span>
            {selectedWidget && (
              <span className="text-2xs text-focus font-normal">1 Visual Selected</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Visual Archetype Palette */}
            <div>
              <div className="text-2xs font-bold uppercase tracking-wider text-muted mb-2">Visual Types</div>
              <div className="grid grid-cols-4 gap-1 bg-white p-2 border border-line rounded">
                {VISUAL_TYPES.map((vt) => {
                  const isActive = selectedWidget?.chart_type === vt.id;
                  return (
                    <button
                      key={vt.id}
                      onClick={() => {
                        if (selectedWidget) {
                          mutateWidget(selectedWidget, { newChartType: vt.id });
                        }
                      }}
                      title={`${vt.label}${selectedWidget ? ' (Click to change visual type)' : ''}`}
                      className={`h-9 rounded flex flex-col items-center justify-center transition ${
                        isActive
                          ? 'border border-focus bg-focus-tint text-focus'
                          : 'hover:bg-hover text-muted hover:text-ink'
                      }`}
                    >
                      {vt.icon}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Visual Configuration & Lineage */}
            {selectedWidget ? (
              <div className="space-y-3">
                <div className="text-2xs font-bold uppercase tracking-wider text-muted">Format Selected Visual</div>
                <div className="bg-white border border-line rounded p-2.5 space-y-2">
                  <div>
                    <div className="text-2xs text-muted">Title</div>
                    <div className="font-semibold text-xs text-ink truncate">{selectedWidget.title}</div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted">Archetype</div>
                    <div className="font-mono text-2xs text-focus">{selectedWidget.chart_type}</div>
                  </div>
                  {selectedWidget.x_field && (
                    <div>
                      <div className="text-2xs text-muted">X-Axis Dimension</div>
                      <div className="font-mono text-2xs text-ink">{selectedWidget.x_field}</div>
                    </div>
                  )}
                  {selectedWidget.y_fields.length > 0 && (
                    <div>
                      <div className="text-2xs text-muted">Y-Axis Values</div>
                      <div className="font-mono text-2xs text-ink truncate">
                        {selectedWidget.y_fields.join(', ')}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setEditingWidget(selectedWidget)}
                    className="w-full mt-2 h-7 rounded border border-line-strong bg-white hover:bg-hover text-xs font-semibold text-ink flex items-center justify-center gap-1.5 transition"
                  >
                    <Code2 className="h-3.5 w-3.5" /> Inspect SQL & Logic
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-line rounded p-3 text-center text-muted">
                <p className="text-2xs">Select any visual on the canvas to change its chart type or inspect its query.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. Fields / Data Catalog Pane */}
      {openPanes.fields && (
        <section aria-label="Data Fields Pane" className="w-56 flex flex-col h-full bg-[#faf9f8]">
          <div className="h-9 px-3 border-b border-line flex items-center justify-between font-semibold text-ink bg-white">
            <span>Data / Fields</span>
            {schemaCatalog && (
              <span className="text-2xs text-muted">{schemaCatalog.tables.length} Tables</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {schemaCatalog ? (
              schemaCatalog.tables.map((tbl) => (
                <div key={tbl.table_name} className="bg-white border border-line rounded p-2 space-y-1">
                  <div
                    onClick={() => openTableInDataView(tbl.table_name)}
                    className="flex items-center justify-between cursor-pointer hover:text-focus transition"
                    title="View this table in Data View"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Table2 className="h-3.5 w-3.5 text-muted shrink-0" />
                      <span className="font-mono font-semibold text-xs text-ink truncate">
                        {tbl.table_name}
                      </span>
                    </div>
                    <span className="text-2xs text-muted shrink-0 tnum">{tbl.row_count}</span>
                  </div>

                  {/* Columns list */}
                  <div className="pl-3.5 space-y-0.5 border-l border-line ml-1 mt-1">
                    {tbl.columns.map((c) => {
                      const isNum =
                        c.data_type.toLowerCase().includes('int') ||
                        c.data_type.toLowerCase().includes('float') ||
                        c.data_type.toLowerCase().includes('double') ||
                        c.data_type.toLowerCase().includes('decimal');
                      const isDate =
                        c.data_type.toLowerCase().includes('date') ||
                        c.data_type.toLowerCase().includes('time');

                      return (
                        <div
                          key={c.name}
                          className="flex items-center justify-between text-2xs text-muted hover:text-ink py-0.5"
                        >
                          <div className="flex items-center gap-1 truncate">
                            {c.is_primary_key ? (
                              <KeyRound className="h-2.5 w-2.5 text-[#c19c00] shrink-0" />
                            ) : isNum ? (
                              <Hash className="h-2.5 w-2.5 text-focus shrink-0" />
                            ) : isDate ? (
                              <Calendar className="h-2.5 w-2.5 text-good shrink-0" />
                            ) : (
                              <Type className="h-2.5 w-2.5 text-subtle shrink-0" />
                            )}
                            <span className="font-mono truncate">{c.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted text-2xs">
                No database schema loaded. Connect a data source to explore fields.
              </div>
            )}
          </div>
        </section>
      )}
    </aside>
  );
};
