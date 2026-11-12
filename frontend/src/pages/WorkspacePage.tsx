import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileSpreadsheet, Layers, Plus } from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { useDashboardStore } from '../store/useDashboardStore';
import { WorkspaceRibbon } from '../components/ribbon/WorkspaceRibbon';
import { AgentConversationSidebar } from '../components/agent/AgentConversationSidebar';
import { DataModelerSidebar } from '../components/datamodel/DataModelerSidebar';
import { DashboardGrid } from '../components/canvas/DashboardGrid';
import { UnifiedDataSourceModal } from '../components/modals/UnifiedDataSourceModal';
import { ERDiagramModal } from '../components/datamodel/ERDiagramModal';
import { WidgetInspectorModal } from '../components/canvas/WidgetInspectorModal';
import { PipelineDrawer } from '../components/pipeline/PipelineDrawer';
import { OllamaManagerModal } from '../components/llm/OllamaManagerModal';

export const WorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    projects,
    activeProjectId,
    openProject,
    syncDashboardToProject,
    addDashboardPage,
    setActiveDashboardPage,
  } = useProjectStore();

  const {
    manifest,
    layouts,
    layoutPreset,
    crossFilter,
    fetchOllamaStatus,
    fetchConnectors,
    fetchSchema,
    fetchSavedPipelines,
  } = useDashboardStore();

  const project = useMemo(
    () => projects.find((p) => p.id === (id || activeProjectId)) || null,
    [projects, id, activeProjectId]
  );

  const activePage = useMemo(() => {
    if (!project) return null;
    return (
      project.pages.find((pg) => pg.id === project.activePageId) ||
      project.pages[0] ||
      null
    );
  }, [project]);

  const hydratedPageKeyRef = useRef<string | null>(null);

  // 1. Open project & fetch global statuses on mount / route :id change
  useEffect(() => {
    fetchOllamaStatus();
    fetchConnectors();
    fetchSavedPipelines();
  }, []);

  useEffect(() => {
    if (!id) {
      navigate('/projects', { replace: true });
      return;
    }
    const existing = useProjectStore.getState().projects.find((p) => p.id === id);
    if (!existing) {
      navigate('/projects', { replace: true });
      return;
    }
    openProject(id);
    const page = existing.pages.find((pg) => pg.id === existing.activePageId) || existing.pages[0];
    const isBlank =
      !existing.isSample &&
      (!existing.dataSources || existing.dataSources.length === 0) &&
      (!existing.embeddedCsvTables || existing.embeddedCsvTables.length === 0);

    useDashboardStore.setState({
      activeConnectorId: existing.activeConnectorId || 'default_sqlite_commerce',
      schemaCatalog: existing.schemaCatalog || null,
      layoutPreset: page?.layoutPreset || 'executive',
      layouts: isBlank ? {} : page?.layouts || {},
      crossFilter: isBlank ? null : page?.crossFilter || null,
      manifest: isBlank ? null : (page?.widgets && page.widgets.length > 0 ? existing.manifest : null),
      agentTraces: [],
      isAnalyzing: false,
    });

    if (existing.dataSources.length > 0 && existing.activeConnectorId) {
      fetchSchema(existing.activeConnectorId);
    }
  }, [id, navigate, openProject, fetchSchema]);

  // 2. Hydrate useDashboardStore whenever the active project or active page tab changes
  useEffect(() => {
    if (!project || !activePage) return;
    const pageKey = `${project.id}:${activePage.id}`;
    if (hydratedPageKeyRef.current === pageKey) return;
    hydratedPageKeyRef.current = pageKey;

    const isBlank =
      !project.isSample &&
      (!project.dataSources || project.dataSources.length === 0) &&
      (!project.embeddedCsvTables || project.embeddedCsvTables.length === 0);

    const hasPageWidgets = !isBlank && activePage.widgets && activePage.widgets.length > 0;
    const baseManifest = project.manifest;

    const hydratedManifest = hasPageWidgets
      ? baseManifest
        ? {
            ...baseManifest,
            widgets: activePage.widgets,
            layouts: activePage.layouts,
          }
        : {
            pipeline_id: `pipe-${project.id}`,
            title: activePage.title,
            user_query: '',
            created_at: project.createdAt,
            last_replayed_at: null,
            connector_id: project.activeConnectorId || 'default_sqlite_commerce',
            connector_name: project.name,
            dialect: 'sqlite' as const,
            schema_fingerprint: project.schemaCatalog?.schema_fingerprint || '',
            model_used: 'local',
            steps: [],
            widgets: activePage.widgets,
            layouts: activePage.layouts,
            executive_summary: project.description,
            key_insights: [],
            suggested_followups: [],
            reproducibility_verified: true,
            data_drifted: false,
          }
      : null;

    useDashboardStore.setState({
      activeConnectorId: project.activeConnectorId || 'default_sqlite_commerce',
      schemaCatalog: project.schemaCatalog,
      layoutPreset: activePage.layoutPreset || 'executive',
      layouts: isBlank ? {} : activePage.layouts || {},
      crossFilter: isBlank ? null : activePage.crossFilter || null,
      manifest: hydratedManifest,
    });
  }, [project?.id, activePage?.id]);

  // 3. Sync useDashboardStore updates back to useProjectStore for .ifpf persistence
  useEffect(() => {
    if (!project || !activePage) return;
    const pageKey = `${project.id}:${activePage.id}`;
    if (hydratedPageKeyRef.current !== pageKey) return;

    const isBlank =
      !project.isSample &&
      (!project.dataSources || project.dataSources.length === 0) &&
      (!project.embeddedCsvTables || project.embeddedCsvTables.length === 0);

    syncDashboardToProject(project.id, {
      manifest: isBlank ? null : manifest,
      widgets: isBlank ? [] : (manifest ? manifest.widgets : activePage.widgets),
      layouts: isBlank ? {} : layouts,
      layoutPreset,
      crossFilter: isBlank ? null : crossFilter,
    });
  }, [manifest, layouts, layoutPreset, crossFilter]);

  if (!project) {
    return null;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Desktop Menu & Ribbon */}
      <WorkspaceRibbon />

      {/* 3-Pane Workbench Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Conversational Front Agent & In-Textbox Model Selector */}
        <AgentConversationSidebar />

        {/* Center: Scrollable BI Canvas + Bottom Page Tabs */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/60 min-w-0">
          {/* Scrollable Dashboard Grid Canvas */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <DashboardGrid />
          </div>

          {/* Bottom PowerBI-Style Page Tab Bar */}
          <footer className="h-9 shrink-0 border-t border-slate-800/60 bg-slate-950 px-3 flex items-center justify-between gap-2 select-none">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {project.pages.map((pg) => {
                const isActive = pg.id === (activePage?.id || project.activePageId);
                return (
                  <button
                    key={pg.id}
                    type="button"
                    onClick={() => setActiveDashboardPage(project.id, pg.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                      isActive
                        ? 'bg-slate-800/90 text-slate-100 border border-slate-700/70 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Layers className="h-3 w-3 text-indigo-400" />
                    <span>{pg.title}</span>
                    {pg.widgets.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-500">
                        {pg.widgets.length}
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => addDashboardPage(project.id)}
                title="Add new dashboard page"
                className="inline-flex items-center justify-center h-6 w-6 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition ml-0.5"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Right Status Info in Footer */}
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500 font-mono">
              {project.embeddedCsvTables.length > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-400/90">
                  <FileSpreadsheet className="h-3 w-3" />
                  {project.embeddedCsvTables.length} CSV
                </span>
              )}
              <span>
                {(project.schemaCatalog?.tables.length || 0)} tables •{' '}
                {project.virtualRelations.length} relations
              </span>
            </div>
          </footer>
        </main>

        {/* Right: Data Modeler & Contextual Properties Sidebar */}
        <DataModelerSidebar />
      </div>

      {/* Global Workspace Modals & Drawers */}
      <UnifiedDataSourceModal />
      <ERDiagramModal />
      <WidgetInspectorModal />
      <PipelineDrawer />
      <OllamaManagerModal />
    </div>
  );
};
export default WorkspacePage;
