import { create } from 'zustand';
import type {
  AgentTraceEvent,
  ChartArchetype,
  ConnectorInfo,
  CrossFilterState,
  DashboardWidgetSpec,
  GridCoordinates,
  OllamaSystemStatus,
  PipelineManifest,
  PipelineSummaryItem,
  SchemaCatalog,
  SQLDialectType,
} from '../types/insightforge';

interface PullProgressState {
  model: string;
  status: string;
  percent: number | null;
  error?: string;
}

export type WorkspaceView = 'home' | 'report' | 'data' | 'lineage';
export type GetDataSource = SQLDialectType | 'csv';
export type SidePane = 'insights' | 'visualizations' | 'fields';

interface DashboardStore {
  // Workspace navigation
  view: WorkspaceView;
  getDataSource: GetDataSource | null;
  openPanes: Record<SidePane, boolean>;
  selectedWidgetId: string | null;
  focusWidgetId: string | null;
  dataViewTable: string | null;
  setView: (view: WorkspaceView) => void;
  openGetData: (source: GetDataSource | null) => void;
  togglePane: (pane: SidePane) => void;
  selectWidget: (id: string | null) => void;
  setFocusWidget: (id: string | null) => void;
  openTableInDataView: (table: string) => void;
  openSampleDataset: () => Promise<void>;
  closeReport: () => void;

  // Ollama State
  ollamaStatus: OllamaSystemStatus | null;
  isStartingOllama: boolean;
  pullProgress: PullProgressState | null;
  isOllamaModalOpen: boolean;

  // Connectors & Schema State
  connectors: ConnectorInfo[];
  activeConnectorId: string;
  schemaCatalog: SchemaCatalog | null;
  isConnectorModalOpen: boolean;

  // Multi-Agent Analysis & Pipeline State
  promptInput: string;
  isAnalyzing: boolean;
  activeAgentNode: string | null;
  agentTraces: AgentTraceEvent[];
  manifest: PipelineManifest | null;
  savedPipelines: PipelineSummaryItem[];
  isPipelineDrawerOpen: boolean;

  // Dynamic Layout & Interactivity State
  layoutPreset: 'executive' | 'bento' | 'compact';
  layouts: Record<string, GridCoordinates[]>;
  crossFilter: CrossFilterState | null;
  editingWidget: DashboardWidgetSpec | null;

  // Actions
  setPromptInput: (val: string) => void;
  setOllamaModalOpen: (open: boolean) => void;
  setConnectorModalOpen: (open: boolean) => void;
  setPipelineDrawerOpen: (open: boolean) => void;
  setEditingWidget: (w: DashboardWidgetSpec | null) => void;
  setCrossFilter: (filter: CrossFilterState | null) => void;

  fetchOllamaStatus: () => Promise<void>;
  startOllamaServer: () => Promise<void>;
  selectOllamaModel: (modelName: string) => Promise<void>;
  pullOllamaModel: (modelTag: string) => Promise<void>;

  fetchConnectors: () => Promise<void>;
  selectConnector: (connectorId: string) => Promise<void>;
  fetchSchema: (connectorId?: string, refresh?: boolean) => Promise<void>;

  runAnalysis: (customQuery?: string) => Promise<void>;
  fetchSavedPipelines: () => Promise<void>;
  loadPipeline: (pipelineId: string) => Promise<void>;
  replayCurrentPipeline: () => Promise<void>;

  updateLayouts: (allLayouts: Record<string, GridCoordinates[]>) => void;
  switchLayoutPreset: (preset: 'executive' | 'bento' | 'compact') => Promise<void>;
  mutateWidget: (
    widget: DashboardWidgetSpec,
    changes: { newChartType?: ChartArchetype; newSqlQuery?: string; newTitle?: string }
  ) => Promise<void>;
}

export const SAMPLE_CONNECTOR_ID = 'default_sqlite_commerce';

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  view: 'home',
  getDataSource: null,
  openPanes: { insights: true, visualizations: true, fields: true },
  selectedWidgetId: null,
  focusWidgetId: null,
  dataViewTable: null,
  setView: (view) => set({ view }),
  openGetData: (source) => set({ getDataSource: source }),
  togglePane: (pane) => set((s) => ({ openPanes: { ...s.openPanes, [pane]: !s.openPanes[pane] } })),
  selectWidget: (id) =>
    set((s) => ({
      selectedWidgetId: id,
      openPanes: id ? { ...s.openPanes, visualizations: true } : s.openPanes,
    })),
  setFocusWidget: (id) => set({ focusWidgetId: id }),
  openTableInDataView: (table) => set({ view: 'data', dataViewTable: table }),
  openSampleDataset: async () => {
    // The sample is opt-in: picking it opens an empty report page, it does not generate one.
    set({ manifest: null, agentTraces: [], selectedWidgetId: null, crossFilter: null, promptInput: '', view: 'report' });
    await get().selectConnector(SAMPLE_CONNECTOR_ID);
  },
  closeReport: () =>
    set({ manifest: null, layouts: {}, agentTraces: [], selectedWidgetId: null, crossFilter: null, promptInput: '', view: 'home' }),

  ollamaStatus: null,
  isStartingOllama: false,
  pullProgress: null,
  isOllamaModalOpen: false,

  connectors: [],
  activeConnectorId: SAMPLE_CONNECTOR_ID,
  schemaCatalog: null,
  isConnectorModalOpen: false,

  promptInput: '',
  isAnalyzing: false,
  activeAgentNode: null,
  agentTraces: [],
  manifest: null,
  savedPipelines: [],
  isPipelineDrawerOpen: false,

  layoutPreset: 'executive',
  layouts: {},
  crossFilter: null,
  editingWidget: null,

  setPromptInput: (val) => set({ promptInput: val }),
  setOllamaModalOpen: (open) => set({ isOllamaModalOpen: open }),
  setConnectorModalOpen: (open) => set({ isConnectorModalOpen: open }),
  setPipelineDrawerOpen: (open) => set({ isPipelineDrawerOpen: open }),
  setEditingWidget: (w) => set({ editingWidget: w }),
  setCrossFilter: (filter) =>
    set((state) => {
      if (
        filter &&
        state.crossFilter &&
        state.crossFilter.column === filter.column &&
        state.crossFilter.value === filter.value
      ) {
        return { crossFilter: null };
      }
      return { crossFilter: filter };
    }),

  fetchOllamaStatus: async () => {
    try {
      const res = await fetch('/api/ollama/status');
      if (res.ok) {
        const data: OllamaSystemStatus = await res.json();
        set({ ollamaStatus: data });
      }
    } catch {
      // ignore transient error
    }
  },

  startOllamaServer: async () => {
    set({ isStartingOllama: true });
    try {
      const res = await fetch('/api/ollama/start', { method: 'POST' });
      if (res.ok) {
        const data: OllamaSystemStatus = await res.json();
        set({ ollamaStatus: data });
      }
    } finally {
      set({ isStartingOllama: false });
    }
  },

  selectOllamaModel: async (modelName: string) => {
    const res = await fetch('/api/ollama/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_name: modelName }),
    });
    if (res.ok) {
      const data: OllamaSystemStatus = await res.json();
      set({ ollamaStatus: data });
    }
  },

  pullOllamaModel: async (modelTag: string) => {
    set({ pullProgress: { model: modelTag, status: 'Initializing download...', percent: 0 } });
    try {
      const res = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelTag }),
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const chunk of parts) {
          const line = chunk.trim();
          if (line.startsWith('data:')) {
            try {
              const payload = JSON.parse(line.slice(5).trim());
              if (payload.status === 'error') {
                set({
                  pullProgress: {
                    model: modelTag,
                    status: 'Error',
                    percent: null,
                    error: payload.error,
                  },
                });
              } else if (payload.status === 'success') {
                set({ pullProgress: null });
                await get().fetchOllamaStatus();
              } else {
                set({
                  pullProgress: {
                    model: modelTag,
                    status: payload.status || 'Downloading...',
                    percent: payload.percent ?? null,
                  },
                });
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
      }
    } catch (err) {
      set({
        pullProgress: {
          model: modelTag,
          status: 'Failed',
          percent: null,
          error: String(err),
        },
      });
    }
  },

  fetchConnectors: async () => {
    const res = await fetch('/api/connectors');
    if (res.ok) {
      const data = await res.json();
      set({ connectors: data.connectors || [] });
    }
  },

  selectConnector: async (connectorId: string) => {
    set({ activeConnectorId: connectorId, crossFilter: null });
    await get().fetchSchema(connectorId);
  },

  fetchSchema: async (connectorId?: string, refresh = false) => {
    const cid = connectorId || get().activeConnectorId;
    const res = await fetch(`/api/connectors/${cid}/schema?refresh=${refresh}`);
    if (res.ok) {
      const data: SchemaCatalog = await res.json();
      set({ schemaCatalog: data });
    }
  },

  runAnalysis: async (customQuery?: string) => {
    const query = (customQuery ?? get().promptInput).trim();
    if (!query) return;

    set({
      promptInput: query,
      isAnalyzing: true,
      activeAgentNode: 'schema_profiler',
      agentTraces: [],
      crossFilter: null,
      selectedWidgetId: null,
      view: 'report',
    });

    try {
      const { activeConnectorId, ollamaStatus, layoutPreset } = get();
      const res = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          connector_id: activeConnectorId,
          model_name: ollamaStatus?.selected_model || null,
          layout_preset: layoutPreset,
        }),
      });

      if (!res.ok || !res.body) {
        const fallback = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            connector_id: activeConnectorId,
            model_name: ollamaStatus?.selected_model || null,
            layout_preset: layoutPreset,
          }),
        });
        if (fallback.ok) {
          const data = await fallback.json();
          set({
            manifest: data.manifest,
            layouts: data.manifest?.layouts || {},
            agentTraces: data.traces || [],
          });
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith('data:')) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim());
            if (payload.type === 'node_update') {
              set((state) => ({
                activeAgentNode: payload.node,
                agentTraces: payload.trace
                  ? [...state.agentTraces, payload.trace]
                  : state.agentTraces,
              }));
            } else if (payload.type === 'complete' && payload.manifest) {
              set({
                manifest: payload.manifest,
                layouts: payload.manifest.layouts || {},
                agentTraces: payload.traces || get().agentTraces,
                activeAgentNode: null,
              });
            }
          } catch {
            // ignore chunk error
          }
        }
      }
      await get().fetchSavedPipelines();
    } finally {
      set({ isAnalyzing: false, activeAgentNode: null });
    }
  },

  fetchSavedPipelines: async () => {
    const res = await fetch('/api/pipelines');
    if (res.ok) {
      const data = await res.json();
      set({ savedPipelines: data.pipelines || [] });
    }
  },

  loadPipeline: async (pipelineId: string) => {
    const res = await fetch(`/api/pipelines/${pipelineId}`);
    if (res.ok) {
      const data: PipelineManifest = await res.json();
      set({
        manifest: data,
        layouts: data.layouts || {},
        promptInput: data.user_query,
        activeConnectorId: data.connector_id,
        crossFilter: null,
        selectedWidgetId: null,
        agentTraces: [],
        view: 'report',
      });
      await get().fetchSchema(data.connector_id);
    }
  },

  replayCurrentPipeline: async () => {
    const current = get().manifest;
    if (!current) return;
    set({ isAnalyzing: true });
    try {
      const res = await fetch(`/api/pipelines/${current.pipeline_id}/replay`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated: PipelineManifest = await res.json();
        set({
          manifest: updated,
          layouts: updated.layouts || get().layouts,
        });
      }
    } finally {
      set({ isAnalyzing: false });
    }
  },

  updateLayouts: (allLayouts) => {
    set({ layouts: allLayouts });
  },

  switchLayoutPreset: async (preset) => {
    const current = get().manifest;
    set({ layoutPreset: preset });
    if (!current) return;
    const res = await fetch('/api/layout/recompute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgets: current.widgets,
        preset,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      set({ layouts: data.layouts });
    }
  },

  mutateWidget: async (widget, changes) => {
    const { activeConnectorId, manifest } = get();
    const res = await fetch('/api/widget/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connector_id: activeConnectorId,
        widget,
        new_chart_type: changes.newChartType,
        new_sql_query: changes.newSqlQuery,
        new_title: changes.newTitle,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Widget mutation failed' }));
      throw new Error(err.detail || 'Widget mutation failed');
    }
    const data = await res.json();
    const updatedWidget: DashboardWidgetSpec = data.widget;
    if (manifest) {
      const nextWidgets = manifest.widgets.map((w) =>
        w.id === updatedWidget.id ? updatedWidget : w
      );
      set({
        manifest: { ...manifest, widgets: nextWidgets },
      });
    }
  },
}));
