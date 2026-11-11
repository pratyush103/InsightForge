import React, { useEffect } from 'react';
import {
  FilterX,
  ShieldCheck,
  LayoutDashboard,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { useDashboardStore } from './store/useDashboardStore';
import { PowerBiRibbon } from './components/workspace/PowerBiRibbon';
import { PowerBiLeftRail } from './components/workspace/PowerBiLeftRail';
import { PowerBiSidePanes } from './components/workspace/PowerBiSidePanes';
import { EmptyCanvas } from './components/workspace/EmptyCanvas';
import { DataView } from './components/workspace/DataView';
import { ModelView } from './components/workspace/ModelView';
import { DashboardGrid } from './components/canvas/DashboardGrid';
import { WidgetInspectorModal } from './components/canvas/WidgetInspectorModal';
import { OllamaManagerModal } from './components/llm/OllamaManagerModal';
import { ConnectorModal } from './components/connectors/ConnectorModal';
import { PipelineDrawer } from './components/pipeline/PipelineDrawer';

export const App: React.FC = () => {
  const {
    view,
    manifest,
    fetchOllamaStatus,
    fetchConnectors,
    fetchSchema,
    fetchSavedPipelines,
    crossFilter,
    setCrossFilter,
    replayCurrentPipeline,
    isAnalyzing,
  } = useDashboardStore();

  useEffect(() => {
    fetchOllamaStatus();
    fetchConnectors();
    fetchSchema();
    fetchSavedPipelines();
    // Intentionally DO NOT auto-run analysis! The user begins with a clean workspace.
  }, []);

  return (
    <div className="h-dvh w-full flex flex-col bg-canvas text-ink overflow-hidden font-sans">
      {/* 1. Top Power BI Ribbon Bar */}
      <PowerBiRibbon />

      {/* 2. Workspace Body: Left Rail + Center Canvas + Right Panes */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Power BI Left View Rail (Report / Data / Model) */}
        <PowerBiLeftRail />

        {/* Center View Switcher */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-canvas">
          {view === 'data' ? (
            <DataView />
          ) : view === 'lineage' ? (
            <ModelView />
          ) : !manifest ? (
            <EmptyCanvas />
          ) : (
            /* Report View Canvas */
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Report Canvas Breadcrumb & Filter Bar */}
              <div className="h-9 px-4 border-b border-line bg-white flex items-center justify-between shrink-0 text-xs select-none">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-semibold text-ink truncate text-xs flex items-center gap-1.5">
                    <LayoutDashboard className="h-3.5 w-3.5 text-focus" />
                    {manifest.title}
                  </span>
                  <span className="text-2xs text-muted font-mono flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-good" />
                    Verified SQL Lineage
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {crossFilter && (
                    <div className="flex items-center gap-1.5 rounded bg-focus-tint border border-focus/30 px-2 py-0.5 text-2xs text-focus">
                      <span>
                        Filter: <code className="font-bold">{crossFilter.column} = "{crossFilter.value}"</code>
                      </span>
                      <button
                        onClick={() => setCrossFilter(null)}
                        title="Clear cross-filter"
                        className="hover:text-ink font-bold ml-1"
                      >
                        <FilterX className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={replayCurrentPipeline}
                    disabled={isAnalyzing}
                    title="Replay SQL pipeline without LLM"
                    className="h-6 px-2 rounded border border-line bg-white hover:bg-hover text-2xs font-medium text-ink flex items-center gap-1 transition disabled:opacity-40"
                  >
                    <RefreshCw className={`h-2.5 w-2.5 text-muted ${isAnalyzing ? 'animate-spin' : ''}`} />
                    Replay
                  </button>
                </div>
              </div>

              {/* Main Report Page Desk */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-canvas flex justify-center">
                {/* 16:9 Report Sheet Container */}
                <div className="w-full max-w-[1500px]">
                  <DashboardGrid />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Power BI Right Docked Panes (Only in Report View) */}
        {view === 'report' && <PowerBiSidePanes />}
      </div>

      {/* Modals & Dialogs */}
      <OllamaManagerModal />
      <ConnectorModal />
      <PipelineDrawer />
      <WidgetInspectorModal />
    </div>
  );
};

export default App;
