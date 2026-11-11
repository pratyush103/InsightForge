import React, { useEffect } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FilterX,
  GitBranch,
  LayoutGrid,
  Loader2,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useDashboardStore } from './store/useDashboardStore';
import { DashboardGrid } from './components/canvas/DashboardGrid';
import { WidgetInspectorModal } from './components/canvas/WidgetInspectorModal';
import { OllamaManagerModal } from './components/llm/OllamaManagerModal';
import { ConnectorModal } from './components/connectors/ConnectorModal';
import { PipelineDrawer } from './components/pipeline/PipelineDrawer';

const PRESET_PROMPTS = [
  {
    label: 'Executive Revenue & Margin',
    query: 'Analyze executive revenue trajectory, profit margins, regional share, and product performance',
  },
  {
    label: 'SaaS Churn & ARR Retention',
    query: 'Analyze SaaS churn reasons, ARR exposure, customer health score, and retention by segment',
  },
  {
    label: 'Marketing Funnel & ROAS',
    query: 'Evaluate marketing attribution funnel, campaign spend vs pipeline value, and regional conversions',
  },
  {
    label: 'Support SLA & CSAT',
    query: 'Inspect customer support ticket volume, SLA breaches, resolution velocity, and CSAT scores',
  },
];

export const App: React.FC = () => {
  const {
    ollamaStatus,
    isStartingOllama,
    setOllamaModalOpen,
    fetchOllamaStatus,
    startOllamaServer,
    connectors,
    activeConnectorId,
    setConnectorModalOpen,
    fetchConnectors,
    fetchSchema,
    promptInput,
    setPromptInput,
    isAnalyzing,
    activeAgentNode,
    agentTraces,
    manifest,
    runAnalysis,
    fetchSavedPipelines,
    setPipelineDrawerOpen,
    replayCurrentPipeline,
    layoutPreset,
    switchLayoutPreset,
    crossFilter,
    setCrossFilter,
  } = useDashboardStore();

  useEffect(() => {
    fetchOllamaStatus();
    fetchConnectors();
    fetchSchema();
    fetchSavedPipelines();
    runAnalysis();
  }, []);

  const activeConnector = connectors.find((c) => c.id === activeConnectorId);

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runAnalysis();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl px-4 sm:px-6 py-3">
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-slate-950 shadow-lg shadow-indigo-500/25 font-bold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">InsightForge</h1>
                <span className="rounded-md bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-indigo-300">
                  LangGraph Multi-Agent BI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Reproducible Data Analysis Pipelines & Automated Executive Visualization
              </p>
            </div>
          </div>

          {/* Right Controls: SQL Connector, Ollama Status, Pipeline DAG */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Active SQL Connector Pill */}
            <button
              onClick={() => setConnectorModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 hover:border-slate-700 px-3 py-1.5 text-xs transition"
            >
              <Database className="h-3.5 w-3.5 text-cyan-400" />
              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-cyan-300">
                {activeConnector?.dialect || 'sqlite'}
              </span>
              <span className="font-medium text-slate-200 max-w-[180px] truncate">
                {activeConnector?.name || 'SaaS & Commerce DB'}
              </span>
            </button>

            {/* Ollama Status & Model Selector Pill */}
            <button
              onClick={() => setOllamaModalOpen(true)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                ollamaStatus?.status === 'running'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                  : ollamaStatus?.status === 'installed_stopped'
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                  : 'border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              {ollamaStatus?.status === 'running' ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono">
                    {ollamaStatus.selected_model || 'Select Model (Pull)'}
                  </span>
                </>
              ) : ollamaStatus?.status === 'installed_stopped' ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>Ollama Stopped (Click to Launch)</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  <span>Install / Configure Ollama</span>
                </>
              )}
            </button>

            {/* Reproducible Pipeline Lineage Button */}
            {manifest && (
              <button
                onClick={() => setPipelineDrawerOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/15 hover:bg-indigo-500/25 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition"
              >
                <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
                <span>Pipeline DAG ({manifest.steps.length} Steps)</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Smart Ollama Lifecycle Prompt Banner (when installed & stopped or not installed) */}
      {ollamaStatus && ollamaStatus.status !== 'running' && (
        <div className="border-b border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-slate-900 px-4 sm:px-6 py-2.5">
          <div className="mx-auto max-w-[1600px] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-200">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              {ollamaStatus.status === 'installed_stopped' ? (
                <span>
                  <strong>Ollama Detected ({ollamaStatus.cli_version || 'Installed'})</strong> — The background server is currently stopped. Launch it to run local LLM queries, or browse recommended models like{' '}
                  <code className="font-mono text-indigo-300">qwen2.5-coder:7b</code>.
                </span>
              ) : (
                <span>
                  <strong>Ollama Not Installed</strong> — Install Ollama to run local open-weights models (`qwen2.5-coder:7b`, `llama3.1:8b`, `deepseek-r1:8b`).
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {ollamaStatus.status === 'installed_stopped' ? (
                <button
                  onClick={startOllamaServer}
                  disabled={isStartingOllama}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-3 py-1 text-xs font-semibold text-slate-950 transition"
                >
                  {isStartingOllama ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                  Launch Ollama Now
                </button>
              ) : (
                <a
                  href={ollamaStatus.install_guide.windows_installer_url || 'https://ollama.com/download'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs font-semibold text-white transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install Ollama
                </a>
              )}
              <button
                onClick={() => setOllamaModalOpen(true)}
                className="rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 transition"
              >
                Recommended Models
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 sm:px-6 py-5 space-y-5">
        {/* Prompt Command Center */}
        <section className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-xl space-y-3">
          <form onSubmit={handlePromptSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Wand2 className="h-4 w-4 text-indigo-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Ask a business intelligence question across your SQL database (e.g., 'Analyze SaaS churn, ARR exposure, and cohort retention by segment')..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isAnalyzing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition shrink-0"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running LangGraph Agents...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Generate BI Dashboard
                </>
              )}
            </button>
          </form>

          {/* Preset Analytical Scenarios & Agent Trace Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 mr-1">Quick Scenarios:</span>
              {PRESET_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => runAnalysis(item.query)}
                  className="rounded-lg border border-slate-800 bg-slate-950/80 hover:border-indigo-500/50 hover:text-indigo-300 px-2.5 py-1 text-[11px] text-slate-300 transition"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Live Multi-Agent Execution Trace */}
            <div className="flex flex-wrap items-center gap-1.5">
              {agentTraces.map((tr, idx) => (
                <span
                  key={idx}
                  title={`${tr.title} — ${tr.detail}`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-950 border border-slate-800 px-2.5 py-0.5 text-[10px] font-mono text-slate-300"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  {tr.agent.replace('Agent', '')}
                  <span className="text-slate-500">{tr.duration_ms}ms</span>
                </span>
              ))}
              {isAnalyzing && activeAgentNode && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 px-2.5 py-0.5 text-[10px] font-mono text-indigo-300 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {activeAgentNode}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Executive AI Summary & Dashboard Layout Controls */}
        {manifest && (
          <section className="rounded-2xl border border-slate-800/90 bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-indigo-950/25 p-5 shadow-xl space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Bot className="h-4 w-4 text-indigo-400" />
                  <h2 className="text-base sm:text-lg font-bold text-white">{manifest.title}</h2>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono text-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Reproducible Manifest Verified
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {manifest.executive_summary}
                </p>
              </div>

              {/* Dynamic Layout Preset Switcher & Replay */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
                  <LayoutGrid className="h-3.5 w-3.5 text-slate-400 ml-2 mr-1.5" />
                  {(
                    [
                      { id: 'executive', label: 'Executive' },
                      { id: 'bento', label: 'Bento' },
                      { id: 'compact', label: 'Compact 3-Col' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => switchLayoutPreset(preset.id)}
                      className={`rounded-lg px-2.5 py-1 font-medium transition ${
                        layoutPreset === preset.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={replayCurrentPipeline}
                  disabled={isAnalyzing}
                  title="Deterministically replay SQL pipeline without LLM"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  Replay DAG
                </button>
              </div>
            </div>

            {/* Key Insights Bullets & Follow-up Prompts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-800/70">
              <div className="lg:col-span-7 flex flex-wrap gap-2">
                {manifest.key_insights.slice(0, 4).map((ins, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-slate-950/75 border border-slate-800/90 px-2.5 py-1 text-xs text-slate-300"
                  >
                    • {ins}
                  </span>
                ))}
              </div>

              <div className="lg:col-span-5 flex flex-wrap items-center justify-end gap-1.5">
                {manifest.suggested_followups.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => runAnalysis(f)}
                    className="rounded-lg bg-indigo-500/10 border border-indigo-500/25 hover:bg-indigo-500/20 px-2.5 py-1 text-[11px] text-indigo-300 transition text-left"
                  >
                    → {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Cross-Filter Banner */}
            {crossFilter && (
              <div className="flex items-center justify-between rounded-xl bg-indigo-600/15 border border-indigo-500/40 px-3.5 py-2 text-xs text-indigo-200">
                <span>
                  Active Cross-Filter:{' '}
                  <code className="font-mono font-bold text-white">
                    {crossFilter.column} = "{crossFilter.value}"
                  </code>{' '}
                  (Applied across linked charts & tables)
                </span>
                <button
                  onClick={() => setCrossFilter(null)}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 px-2.5 py-1 text-xs font-semibold text-white transition"
                >
                  <FilterX className="h-3.5 w-3.5" /> Clear Filter
                </button>
              </div>
            )}
          </section>
        )}

        {/* Dynamic Drag-and-Drop Dashboard Grid */}
        <DashboardGrid />
      </main>

      {/* Modals & Drawers */}
      <OllamaManagerModal />
      <ConnectorModal />
      <PipelineDrawer />
      <WidgetInspectorModal />
    </div>
  );
};
export default App;
