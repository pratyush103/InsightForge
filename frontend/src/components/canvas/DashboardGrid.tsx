import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Responsive } from 'react-grid-layout';
import ReactECharts from 'echarts-for-react';
import {
  ArrowRight,
  Database,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { useProjectStore } from '../../store/useProjectStore';
import type { DashboardWidgetSpec, GridCoordinates } from '../../types/insightforge';
import { KpiCardWidget } from '../charts/KpiCardWidget';
import { EChartsWidget } from '../charts/EChartsWidget';
import { DataTableWidget } from '../charts/DataTableWidget';

const STARTER_PROMPTS = [
  {
    title: 'Executive Revenue & Margin Trajectory',
    description: 'KPI summary, monthly revenue & margin spline, regional performance, and top products.',
    query: 'Analyze executive revenue trajectory, profit margins, regional share, and product performance',
  },
  {
    title: 'SaaS Churn & Cohort Retention',
    description: 'Inspect ARR exposure, customer health distribution, and retention rates by segment.',
    query: 'Analyze SaaS churn reasons, ARR exposure, customer health score, and retention by segment',
  },
  {
    title: 'Customer Support SLA & Resolution Velocity',
    description: 'Evaluate ticket volume, SLA breach rates, resolution time, and CSAT scores.',
    query: 'Inspect customer support ticket volume, SLA breaches, resolution velocity, and CSAT scores',
  },
];

export const DashboardGrid: React.FC = () => {
  const {
    manifest,
    layouts,
    updateLayouts,
    runAnalysis,
    isAnalyzing,
    activeAgentNode,
  } = useDashboardStore();

  const {
    projects,
    activeProjectId,
    selectedWidgetId,
    setSelectedWidgetId,
    setDataSourceModalOpen,
    syncDashboardToProject,
  } = useProjectStore();

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

  const widgets = useMemo<DashboardWidgetSpec[]>(() => {
    const isBlankNoData =
      Boolean(project) &&
      !project?.isSample &&
      (!project?.dataSources || project.dataSources.length === 0) &&
      (!project?.embeddedCsvTables || project.embeddedCsvTables.length === 0);

    if (isBlankNoData) {
      return [];
    }

    if (activePage?.widgets && activePage.widgets.length > 0) {
      return activePage.widgets;
    }
    if (manifest?.widgets && manifest.widgets.length > 0 && project?.manifest) {
      return manifest.widgets;
    }
    return [];
  }, [project, activePage, manifest]);

  const effectiveLayouts = useMemo<Record<string, GridCoordinates[]>>(() => {
    if (layouts && Object.keys(layouts).length > 0) {
      return layouts;
    }
    return activePage?.layouts || {};
  }, [layouts, activePage]);

  const hasDataSource = useMemo(() => {
    if (!project) return false;
    return (
      project.dataSources.length > 0 ||
      project.embeddedCsvTables.length > 0 ||
      (project.schemaCatalog?.tables && project.schemaCatalog.tables.length > 0) ||
      false
    );
  }, [project]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1120);
  const [expandedWidget, setExpandedWidget] = useState<DashboardWidgetSpec | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth || 1120);
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

  // Empty Canvas Onboarding State
  if (widgets.length === 0) {
    return (
      <div
        ref={wrapperRef}
        className="w-full min-h-[calc(100vh-140px)] flex items-center justify-center p-6"
      >
        <div className="w-full max-w-2xl rounded-2xl border border-slate-800/70 bg-slate-900/35 p-8 space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-10 w-10 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-100 tracking-tight">
              {hasDataSource
                ? 'Data Model Ready — Generate Your First BI View'
                : 'Start Your BI Workspace with a Data Source'}
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {hasDataSource
                ? 'Your project has connected tables in the semantic model. Ask a question in the left agent panel or launch a starter analytical scenario below.'
                : 'Connect a relational SQL database or import CSV flat files to profile tables, build relationships, and generate interactive visuals.'}
            </p>
          </div>

          {/* Primary Data Source Onboarding Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDataSourceModalOpen(true)}
              className="group flex items-start gap-3.5 rounded-xl border border-slate-800/80 bg-slate-950/70 hover:bg-slate-900/80 hover:border-slate-700 p-4 text-left transition"
            >
              <div className="h-9 w-9 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-indigo-400 shrink-0 group-hover:border-indigo-500/40 transition">
                <Database className="h-4 w-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-100">
                  <span>SQL Server / MySQL / SQLite</span>
                  <ArrowRight className="h-3 w-3 text-slate-500 group-hover:translate-x-0.5 group-hover:text-slate-300 transition" />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Connect live database credentials or use the built-in commerce database.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDataSourceModalOpen(true)}
              className="group flex items-start gap-3.5 rounded-xl border border-slate-800/80 bg-slate-950/70 hover:bg-slate-900/80 hover:border-slate-700 p-4 text-left transition"
            >
              <div className="h-9 w-9 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-emerald-400 shrink-0 group-hover:border-emerald-500/40 transition">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-100">
                  <span>Import CSV File</span>
                  <ArrowRight className="h-3 w-3 text-slate-500 group-hover:translate-x-0.5 group-hover:text-slate-300 transition" />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Upload flat files as portable tables and link them with SQL schemas.
                </p>
              </div>
            </button>
          </div>

          {/* Starter Analytical Prompts if a data source is connected */}
          {hasDataSource && (
            <div className="pt-4 border-t border-slate-800/60 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Table2 className="h-3.5 w-3.5 text-indigo-400" />
                  Starter Analytical Prompts
                </span>
                {isAnalyzing && (
                  <span className="inline-flex items-center gap-1.5 text-indigo-300 font-mono text-[10px]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Running {activeAgentNode || 'LangGraph'}...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2">
                {STARTER_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => runAnalysis(item.query)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-950/60 hover:bg-slate-900 hover:border-slate-700 px-3.5 py-2.5 text-left transition disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200">{item.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{item.description}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      onClick={() => setSelectedWidgetId(null)}
      className="w-full pb-8"
    >
      <Responsive
        className="layout"
        width={containerWidth}
        layouts={effectiveLayouts}
        breakpoints={{ lg: 1100, md: 768, sm: 0 }}
        cols={{ lg: 12, md: 8, sm: 4 }}
        rowHeight={38}
        margin={[14, 14]}
        containerPadding={[0, 0]}
        draggableHandle=".drag-handle"
        onLayoutChange={(_current, allLayouts) => {
          const typedLayouts = allLayouts as unknown as Record<string, GridCoordinates[]>;
          updateLayouts(typedLayouts);
          if (project) {
            syncDashboardToProject(project.id, { layouts: typedLayouts });
          }
        }}
      >
        {widgets.map((widget) => {
          const isSelected = selectedWidgetId === widget.id;
          return (
            <div
              key={widget.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedWidgetId(widget.id);
              }}
              className={`rounded-xl border bg-slate-900/50 backdrop-blur-sm transition-all overflow-hidden ${
                isSelected
                  ? 'border-indigo-500/70 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-950/30'
                  : 'border-slate-800/80 hover:border-slate-700/80'
              }`}
            >
              {widget.widget_type === 'kpi' ? (
                <KpiCardWidget widget={widget} />
              ) : widget.widget_type === 'table' ? (
                <DataTableWidget widget={widget} />
              ) : (
                <EChartsWidget widget={widget} onExpand={(w) => setExpandedWidget(w)} />
              )}
            </div>
          );
        })}
      </Responsive>

      {/* Fullscreen Chart Modal */}
      {expandedWidget && (
        <div
          onClick={() => setExpandedWidget(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-6xl h-[82vh] rounded-xl border border-slate-800 bg-slate-950 p-6 flex flex-col justify-between shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
              <div>
                <h2 className="text-base font-semibold text-slate-100">{expandedWidget.title}</h2>
                <p className="text-xs text-slate-400">
                  {expandedWidget.subtitle || expandedWidget.insight_summary}
                </p>
              </div>
              <button
                onClick={() => setExpandedWidget(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition"
              >
                <X className="h-4 w-4" />
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

            <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="truncate">{expandedWidget.sql_query}</span>
              <span className="text-indigo-400 shrink-0 ml-4">{expandedWidget.data_hash}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
