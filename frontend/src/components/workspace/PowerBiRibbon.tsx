import React, { useState } from 'react';
import {
  Cpu,
  Database,
  GitBranch,
  RefreshCw,
  Send,
  Loader2,
  Table2,
  FileSpreadsheet,
  ChevronDown,
  Sparkles,
  LayoutGrid,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { BrandMark, dialectLabel } from '../ui/primitives';

const PRESET_SCENARIOS = [
  {
    label: 'Revenue & Margin',
    query: 'Analyze executive revenue trajectory, profit margins, regional share, and product performance',
  },
  {
    label: 'Churn & ARR',
    query: 'Analyze SaaS churn reasons, ARR exposure, customer health score, and retention by segment',
  },
  {
    label: 'Funnel & ROAS',
    query: 'Evaluate marketing attribution funnel, campaign spend vs pipeline value, and regional conversions',
  },
  {
    label: 'Support SLA & CSAT',
    query: 'Inspect customer support ticket volume, SLA breaches, resolution velocity, and CSAT scores',
  },
];

export const PowerBiRibbon: React.FC = () => {
  const {
    manifest,
    connectors,
    activeConnectorId,
    setConnectorModalOpen,
    openGetData,
    openSampleDataset,
    promptInput,
    setPromptInput,
    runAnalysis,
    isAnalyzing,
    activeAgentNode,
    agentTraces,
    replayCurrentPipeline,
    layoutPreset,
    switchLayoutPreset,
    ollamaStatus,
    setOllamaModalOpen,
    setPipelineDrawerOpen,
    openPanes,
    togglePane,
  } = useDashboardStore();

  const [activeTab, setActiveTab] = useState<'home' | 'view'>('home');
  const [getDataDropdownOpen, setGetDataDropdownOpen] = useState(false);

  const activeConnector = connectors.find((c) => c.id === activeConnectorId);

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    runAnalysis();
  };

  return (
    <header className="bg-white border-b border-line select-none shrink-0 z-30">
      {/* 1. Power BI Title Bar */}
      <div className="h-10 bg-chrome px-3 flex items-center justify-between text-white border-b border-[#3b3a39]">
        <div className="flex items-center gap-2.5">
          <BrandMark size={18} />
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-white tracking-wide">InsightForge</span>
            <span className="text-[#8a8886]">—</span>
            <span className="text-[#c8c6c4] truncate max-w-sm">
              {manifest ? manifest.title : 'Power BI Workspace'}
            </span>
          </div>
        </div>

        {/* Right utility buttons: Active DB, Ollama, Pipeline DAG */}
        <div className="flex items-center gap-2 text-xs">
          {/* Active Data Source Pill */}
          <button
            onClick={() => setConnectorModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-6 rounded px-2 bg-[#2d2c2b] hover:bg-[#3b3a39] border border-[#484644] text-[#edebe9] transition"
          >
            <Database className="h-3 w-3 text-brand" />
            <span className="font-semibold uppercase text-2xs text-brand">
              {activeConnector?.dialect ? dialectLabel(activeConnector.dialect) : 'SQLite'}
            </span>
            <span className="truncate max-w-[140px] text-2xs text-[#c8c6c4]">
              {activeConnector?.name || 'SaaS DB'}
            </span>
          </button>

          {/* Ollama Status Pill */}
          <button
            onClick={() => setOllamaModalOpen(true)}
            className={`inline-flex items-center gap-1.5 h-6 rounded px-2 border transition text-2xs font-medium ${
              ollamaStatus?.status === 'running'
                ? 'border-[#107c10]/40 bg-[#107c10]/15 text-[#dff6dd] hover:bg-[#107c10]/25'
                : ollamaStatus?.status === 'installed_stopped'
                ? 'border-[#c19c00]/40 bg-[#c19c00]/15 text-[#fff4ce] hover:bg-[#c19c00]/25'
                : 'border-[#c50f1f]/40 bg-[#c50f1f]/15 text-[#fde7e9] hover:bg-[#c50f1f]/25'
            }`}
          >
            <Cpu className="h-3 w-3" />
            {ollamaStatus?.status === 'running' ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#107c10]" />
                <span className="font-mono">{ollamaStatus.selected_model || 'Local LLM'}</span>
              </>
            ) : ollamaStatus?.status === 'installed_stopped' ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#c19c00]" />
                <span>Ollama Stopped</span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#c50f1f]" />
                <span>Ollama Offline</span>
              </>
            )}
          </button>

          {/* Pipeline DAG Button */}
          {manifest && (
            <button
              onClick={() => setPipelineDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 h-6 rounded px-2 bg-[#2d2c2b] hover:bg-[#3b3a39] border border-[#484644] text-[#edebe9] text-2xs font-medium transition"
            >
              <GitBranch className="h-3 w-3 text-focus" />
              <span>DAG ({manifest.steps.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Ribbon Tabs Navigation */}
      <div className="flex items-center h-7 px-3 bg-[#f3f2f1] border-b border-line text-xs font-medium gap-1">
        <button
          onClick={() => setActiveTab('home')}
          className={`h-full px-3 transition-colors ${
            activeTab === 'home'
              ? 'bg-white border-t-2 border-brand text-ink font-semibold'
              : 'text-muted hover:text-ink'
          }`}
        >
          Home
        </button>
        <button
          onClick={() => setActiveTab('view')}
          className={`h-full px-3 transition-colors ${
            activeTab === 'view'
              ? 'bg-white border-t-2 border-brand text-ink font-semibold'
              : 'text-muted hover:text-ink'
          }`}
        >
          View
        </button>
      </div>

      {/* 3. Ribbon Action Bar */}
      <div className="h-14 px-3 flex items-center gap-3 overflow-x-auto bg-white">
        {activeTab === 'home' && (
          <>
            {/* Group: Data Sources */}
            <div className="flex items-center gap-1 pr-3 border-r border-line h-full">
              {/* Get Data Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setGetDataDropdownOpen(!getDataDropdownOpen)}
                  className="flex flex-col items-center justify-center h-11 px-2.5 rounded hover:bg-hover active:bg-pressed text-ink transition"
                >
                  <Database className="h-4 w-4 text-focus" />
                  <span className="text-2xs font-semibold flex items-center gap-0.5 mt-0.5">
                    Get Data <ChevronDown className="h-2.5 w-2.5 text-muted" />
                  </span>
                </button>

                {getDataDropdownOpen && (
                  <div
                    className="absolute left-0 top-full mt-1 w-52 rounded bg-white border border-line-strong shadow-flyout p-1 z-50 text-xs"
                    onMouseLeave={() => setGetDataDropdownOpen(false)}
                  >
                    <button
                      onClick={() => {
                        setGetDataDropdownOpen(false);
                        openGetData('sqlite');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-hover flex items-center gap-2 text-ink"
                    >
                      <Database className="h-3.5 w-3.5 text-focus" /> SQLite Database (.db)
                    </button>
                    <button
                      onClick={() => {
                        setGetDataDropdownOpen(false);
                        openGetData('mysql');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-hover flex items-center gap-2 text-ink"
                    >
                      <Table2 className="h-3.5 w-3.5 text-focus" /> MySQL Server
                    </button>
                    <button
                      onClick={() => {
                        setGetDataDropdownOpen(false);
                        openGetData('mssql');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-hover flex items-center gap-2 text-ink"
                    >
                      <Table2 className="h-3.5 w-3.5 text-focus" /> Microsoft SQL Server
                    </button>
                    <div className="my-1 border-t border-line" />
                    <button
                      onClick={() => {
                        setGetDataDropdownOpen(false);
                        openGetData('csv');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-hover flex items-center gap-2 text-ink"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-good" /> Text / CSV File
                    </button>
                  </div>
                )}
              </div>

              {/* Sample Data Button (Never forced on user!) */}
              <button
                onClick={openSampleDataset}
                title="Load sample Commerce & SaaS SQL database (Opt-in)"
                className="flex flex-col items-center justify-center h-11 px-2.5 rounded hover:bg-hover active:bg-pressed text-ink transition"
              >
                <Sparkles className="h-4 w-4 text-brand" />
                <span className="text-2xs font-semibold mt-0.5">Sample Data</span>
              </button>

              {/* Replay / Refresh */}
              {manifest && (
                <button
                  onClick={replayCurrentPipeline}
                  disabled={isAnalyzing}
                  title="Re-execute SQL queries against data source"
                  className="flex flex-col items-center justify-center h-11 px-2.5 rounded hover:bg-hover active:bg-pressed text-ink transition disabled:opacity-40"
                >
                  <RefreshCw className={`h-4 w-4 text-focus ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span className="text-2xs font-semibold mt-0.5">Refresh</span>
                </button>
              )}
            </div>

            {/* Group: Q&A / Natural Language Prompt */}
            <div className="flex-1 min-w-[340px] max-w-2xl flex items-center gap-2 pr-3 border-r border-line h-full">
              <form onSubmit={handlePromptSubmit} className="flex-1 flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Ask a question about your data (e.g. 'Analyze revenue by region and profit margins')..."
                    className="h-8 w-full rounded border border-line-strong bg-white pl-3 pr-8 text-xs text-ink placeholder:text-muted focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                  />
                  {isAnalyzing && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-focus absolute right-2.5 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isAnalyzing || !promptInput.trim()}
                  className="h-8 px-3 rounded bg-focus hover:bg-[#0c5a9e] disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 transition shrink-0"
                >
                  <Send className="h-3 w-3" />
                  Ask
                </button>
              </form>

              {/* Quick Prompt Presets */}
              <div className="hidden lg:flex items-center gap-1">
                {PRESET_SCENARIOS.slice(0, 2).map((sc) => (
                  <button
                    key={sc.label}
                    onClick={() => runAnalysis(sc.query)}
                    className="h-7 px-2 rounded border border-line bg-page hover:bg-hover text-2xs text-muted hover:text-ink transition whitespace-nowrap"
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Group: Layout Preset */}
            <div className="flex items-center gap-1 pr-3 border-r border-line h-full">
              <div className="flex items-center rounded border border-line bg-[#f9f8f7] p-0.5 text-2xs">
                {(
                  [
                    { id: 'executive', label: 'Executive' },
                    { id: 'bento', label: 'Bento' },
                    { id: 'compact', label: 'Compact' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => switchLayoutPreset(preset.id)}
                    className={`px-2 py-1 rounded font-medium transition ${
                      layoutPreset === preset.id
                        ? 'bg-white text-ink shadow-sm font-semibold'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Group: Pane Toggles */}
            <div className="flex items-center gap-1 h-full">
              <button
                onClick={() => togglePane('insights')}
                className={`h-8 px-2 rounded text-2xs font-semibold flex items-center gap-1 border transition ${
                  openPanes.insights
                    ? 'border-focus/40 bg-focus-tint text-focus'
                    : 'border-line bg-white text-muted hover:bg-hover'
                }`}
              >
                <Filter className="h-3 w-3" /> Insights
              </button>
              <button
                onClick={() => togglePane('visualizations')}
                className={`h-8 px-2 rounded text-2xs font-semibold flex items-center gap-1 border transition ${
                  openPanes.visualizations
                    ? 'border-focus/40 bg-focus-tint text-focus'
                    : 'border-line bg-white text-muted hover:bg-hover'
                }`}
              >
                <LayoutGrid className="h-3 w-3" /> Visualizations
              </button>
              <button
                onClick={() => togglePane('fields')}
                className={`h-8 px-2 rounded text-2xs font-semibold flex items-center gap-1 border transition ${
                  openPanes.fields
                    ? 'border-focus/40 bg-focus-tint text-focus'
                    : 'border-line bg-white text-muted hover:bg-hover'
                }`}
              >
                <Table2 className="h-3 w-3" /> Data
              </button>
            </div>
          </>
        )}

        {activeTab === 'view' && (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted">Display Options:</span>
            <div className="flex items-center gap-2">
              <span className="text-ink font-medium">Page Canvas: 16:9 Standard</span>
              <span className="text-muted">•</span>
              <span className="text-ink font-medium">Theme: Power BI Classic</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Active Analysis Status Banner (Subtle, non-distracting) */}
      {isAnalyzing && (
        <div className="h-6 px-3 bg-focus-tint border-t border-line text-2xs text-focus flex items-center justify-between font-mono">
          <span className="flex items-center gap-1.5 font-sans font-medium text-ink">
            <Loader2 className="h-3 w-3 animate-spin text-focus" />
            Analyzing schema & compiling deterministic SQL... {activeAgentNode && `(${activeAgentNode})`}
          </span>
          <div className="flex items-center gap-2">
            {agentTraces.slice(-3).map((tr, idx) => (
              <span key={idx} className="flex items-center gap-1 text-muted">
                <CheckCircle2 className="h-2.5 w-2.5 text-good" />
                {tr.agent.replace('Agent', '')}
              </span>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
