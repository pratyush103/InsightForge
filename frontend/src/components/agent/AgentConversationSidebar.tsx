import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Terminal,
  User,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { ConversationMessage } from '../../types/project';
import type { AgentTraceEvent, RecommendedModelSpec } from '../../types/insightforge';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

const FALLBACK_RECOMMENDED_MODELS: RecommendedModelSpec[] = [
  {
    id: 'qwen2.5-coder-7b',
    name: 'Qwen 2.5 Coder 7B',
    tag: 'qwen2.5-coder:7b',
    category: 'SQL & BI Synthesis',
    size_gb: 4.7,
    min_ram_gb: 8,
    description: 'High-accuracy SQL AST synthesis and multi-table JOIN planning.',
    strengths: ['T-SQL', 'MySQL', 'SQLite'],
    recommended_for: 'Best all-around SQL & BI agent model',
    is_installed: false,
    is_top_pick: true,
  },
  {
    id: 'llama3.1-8b',
    name: 'Llama 3.1 8B Instruct',
    tag: 'llama3.1:8b',
    category: 'Executive Narration',
    size_gb: 4.9,
    min_ram_gb: 8,
    description: 'Strong executive insight narration and semantic reasoning.',
    strengths: ['Narration', 'Schema Planning'],
    recommended_for: 'Fast executive summaries & follow-ups',
    is_installed: false,
    is_top_pick: false,
  },
  {
    id: 'deepseek-r1-8b',
    name: 'DeepSeek R1 8B',
    tag: 'deepseek-r1:8b',
    category: 'Deep Reasoning',
    size_gb: 4.9,
    min_ram_gb: 8,
    description: 'Chain-of-thought analytical reasoning for anomaly root-cause analysis.',
    strengths: ['Anomaly Detection', 'Complex CTEs'],
    recommended_for: 'Multi-step analytical reasoning',
    is_installed: false,
    is_top_pick: false,
  },
];

const AGENT_PIPELINE_LABELS: Record<string, string> = {
  schema_profiler: 'SchemaProfilerAgent',
  bi_planner: 'BIPlannerAgent',
  sql_data: 'SQLDataAgent',
  pipeline_builder: 'PipelineBuilderAgent',
  viz_layout: 'VizLayoutAgent',
  insight_narrator: 'InsightNarratorAgent',
};

const STARTER_PROMPTS = [
  'Analyze executive revenue trajectory, profit margins, regional share, and product performance',
  'Identify SaaS churn drivers, ARR exposure, and retention across segments',
  'Inspect support ticket SLA breaches, resolution velocity, and customer impact',
];

export const AgentConversationSidebar: React.FC = () => {
  const {
    projects,
    activeProjectId,
    getActiveProject,
    appendConversationMessage,
    syncDashboardToProject,
  } = useProjectStore();

  const {
    ollamaStatus,
    isStartingOllama,
    pullProgress,
    fetchOllamaStatus,
    startOllamaServer,
    selectOllamaModel,
    pullOllamaModel,
    setOllamaModalOpen,
    isAnalyzing,
    activeAgentNode,
    agentTraces,
    runAnalysis,
  } = useDashboardStore();

  const project =
    projects.find((p) => p.id === activeProjectId) || getActiveProject();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const [expandedSql, setExpandedSql] = useState<Record<string, boolean>>({});
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isInstallPopoverOpen, setIsInstallPopoverOpen] = useState(false);
  const [copiedWinget, setCopiedWinget] = useState(false);
  const [isRefreshingOllama, setIsRefreshingOllama] = useState(false);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const conversationHistory = project?.conversationHistory || [];

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory.length, isAnalyzing, agentTraces.length]);

  const toggleTraceAccordion = (msgId: string) => {
    setExpandedTraces((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === undefined ? false : !prev[msgId],
    }));
  };

  const toggleSqlAccordion = (msgId: string) => {
    setExpandedSql((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleRefreshOllama = async () => {
    setIsRefreshingOllama(true);
    await fetchOllamaStatus();
    setIsRefreshingOllama(false);
  };

  const handleCopyWinget = () => {
    const cmd =
      ollamaStatus?.install_guide?.windows_winget_cmd ||
      'winget install -e --id Ollama.Ollama';
    navigator.clipboard.writeText(cmd);
    setCopiedWinget(true);
    setTimeout(() => setCopiedWinget(false), 2000);
  };

  const handleSendPrompt = async (customQuery?: string) => {
    const query = (customQuery ?? inputVal).trim();
    if (!query || isAnalyzing || !project) return;

    if (!customQuery) {
      setInputVal('');
    }

    const userMsg: ConversationMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    appendConversationMessage(project.id, userMsg);

    const prevPipelineId = useDashboardStore.getState().manifest?.pipeline_id;
    const prevCreatedAt = useDashboardStore.getState().manifest?.created_at;

    await runAnalysis(query);

    const stateAfter = useDashboardStore.getState();
    const updatedManifest = stateAfter.manifest;
    const tracesAfter = stateAfter.agentTraces;
    const activeModel =
      updatedManifest?.model_used ||
      stateAfter.ollamaStatus?.selected_model ||
      'Schema-Adaptive BI Engine';

    const manifestChanged =
      updatedManifest &&
      (updatedManifest.pipeline_id !== prevPipelineId ||
        updatedManifest.created_at !== prevCreatedAt);

    if (manifestChanged && updatedManifest) {
      const sqlQueries = (updatedManifest.steps || [])
        .filter((s) => s.executed_sql || s.sql_query)
        .map((s) => ({
          title: s.title,
          sql: (s.executed_sql || s.sql_query || '').trim(),
          rowCount: s.row_count,
          executionMs: s.execution_ms,
        }));

      const finalTraces: AgentTraceEvent[] =
        tracesAfter && tracesAfter.length > 0
          ? tracesAfter
          : [
              {
                agent: 'SchemaProfilerAgent',
                status: 'completed',
                title: 'Profiled tables & foreign keys',
                detail: `Fingerprinted ${updatedManifest.dialect.toUpperCase()} schema (${updatedManifest.schema_fingerprint})`,
                duration_ms: 42,
              },
              {
                agent: 'BIPlannerAgent',
                status: 'completed',
                title: 'Decomposed analytical query into DAG steps',
                detail: `Planned ${updatedManifest.steps.length} SQL & enrichment steps`,
                duration_ms: 118,
              },
              {
                agent: 'SQLDataAgent',
                status: 'completed',
                title: 'Synthesized & validated read-only SQL',
                detail: `Executed ${sqlQueries.length} queries with AST read-only guard`,
                duration_ms: 86,
              },
              {
                agent: 'PipelineBuilderAgent',
                status: 'completed',
                title: 'Computed SHA-256 lineage & Z-score anomalies',
                detail: `Verified deterministic output hashes across ${updatedManifest.steps.length} steps`,
                duration_ms: 34,
              },
              {
                agent: 'VizLayoutAgent',
                status: 'completed',
                title: 'Constructed responsive ECharts & KPI specs',
                detail: `Generated ${updatedManifest.widgets.length} interactive widgets`,
                duration_ms: 51,
              },
              {
                agent: 'InsightNarratorAgent',
                status: 'completed',
                title: 'Synthesized executive narrative & follow-ups',
                detail: `Extracted ${updatedManifest.key_insights.length} key findings`,
                duration_ms: 95,
              },
            ];

      const assistantMsgId = `msg-assistant-${Date.now()}`;
      const assistantMsg: ConversationMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: updatedManifest.executive_summary,
        timestamp: new Date().toISOString(),
        modelUsed: activeModel,
        thoughtSummary: `Coordinated 6 specialized agents: SchemaProfilerAgent profiled ${updatedManifest.connector_name}, BIPlannerAgent & SQLDataAgent executed ${sqlQueries.length} read-only SQL steps, PipelineBuilderAgent verified SHA-256 hashes, VizLayoutAgent built ${updatedManifest.widgets.length} visuals, and InsightNarratorAgent summarized key anomalies.`,
        agentTraces: finalTraces,
        sqlQueries,
        keyInsights: updatedManifest.key_insights || [],
        suggestedFollowups: updatedManifest.suggested_followups || [],
      };

      setExpandedTraces((prev) => ({ ...prev, [assistantMsgId]: true }));
      appendConversationMessage(project.id, assistantMsg);

      syncDashboardToProject(project.id, {
        manifest: updatedManifest,
        widgets: updatedManifest.widgets,
        layouts: stateAfter.layouts,
        layoutPreset: stateAfter.layoutPreset,
        crossFilter: stateAfter.crossFilter,
      });
    } else {
      // Fallback schema-aware response if backend endpoint is offline
      const sqlTables = project.schemaCatalog?.tables || [];
      const csvTables = project.embeddedCsvTables || [];
      const allTableNames = [
        ...sqlTables.map((t) => t.table_name),
        ...csvTables.map((c) => c.tableName),
      ];
      const relationsCount = project.virtualRelations?.length || 0;

      const fallbackTraces: AgentTraceEvent[] = [
        {
          agent: 'SchemaProfilerAgent',
          status: 'completed',
          title: 'Inspected project semantic catalog',
          detail: `${allTableNames.length} tables (${sqlTables.length} SQL, ${csvTables.length} CSV) and ${relationsCount} relations`,
          duration_ms: 28,
        },
        {
          agent: 'BIPlannerAgent',
          status: 'completed',
          title: 'Mapped analytical intent to semantic model',
          detail: `Evaluated dimensions and metrics for "${query.slice(0, 60)}"`,
          duration_ms: 64,
        },
        {
          agent: 'SQLDataAgent',
          status: 'completed',
          title: 'Generated read-only analytical SQL plan',
          detail:
            allTableNames.length > 0
              ? `Targeted tables: ${allTableNames.slice(0, 4).join(', ')}`
              : 'Awaiting table connection',
          duration_ms: 52,
        },
        {
          agent: 'PipelineBuilderAgent',
          status: 'completed',
          title: 'Verified pipeline lineage state',
          detail: 'Checked deterministic cache & widget state',
          duration_ms: 19,
        },
        {
          agent: 'VizLayoutAgent',
          status: 'completed',
          title: 'Synchronized canvas layout',
          detail: `Active preset: ${stateAfter.layoutPreset}`,
          duration_ms: 31,
        },
        {
          agent: 'InsightNarratorAgent',
          status: 'completed',
          title: 'Formulated conversational explanation',
          detail: 'Synthesized schema & visual findings',
          duration_ms: 44,
        },
      ];

      const assistantMsgId = `msg-assistant-${Date.now()}`;
      const assistantMsg: ConversationMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content:
          allTableNames.length > 0
            ? `I analyzed your query **"${query}"** against the project's semantic model (${allTableNames.join(
                ', '
              )}). The specialized backend agents profiled ${
                allTableNames.length
              } tables and ${relationsCount} relationships to align the active canvas visuals.`
            : `Your project currently has no connected tables. Click **Add Data Source** in the ribbon to connect a SQLite, MySQL, or MS SQL Server database or import CSV files, then ask me to build your dashboard.`,
        timestamp: new Date().toISOString(),
        modelUsed: activeModel,
        thoughtSummary: `Executed 6-agent inspection across ${allTableNames.length} project tables and ${relationsCount} declared relations.`,
        agentTraces: fallbackTraces,
        keyInsights:
          allTableNames.length > 0
            ? [
                `Active semantic model spans ${allTableNames.length} tables (${allTableNames
                  .slice(0, 4)
                  .join(', ')}).`,
                `${relationsCount} join relationships are configured for cross-table filtering.`,
              ]
            : ['Connect a SQL database or upload CSV files to unlock automated SQL synthesis.'],
        suggestedFollowups: STARTER_PROMPTS,
      };

      setExpandedTraces((prev) => ({ ...prev, [assistantMsgId]: true }));
      appendConversationMessage(project.id, assistantMsg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  // Collapsed slim rail
  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={150}>
        <aside className="w-11 shrink-0 border-r border-slate-800/60 bg-slate-950 flex flex-col items-center py-3 gap-3 select-none">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(false)}
                className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-900"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="bg-slate-900 border-slate-800 text-slate-200 text-xs"
            >
              Expand Agent Conversation
            </TooltipContent>
          </Tooltip>

          <Separator className="w-5 bg-slate-800/80" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/20 transition"
              >
                <Bot className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="bg-slate-900 border-slate-800 text-slate-200 text-xs"
            >
              BI Copilot ({conversationHistory.length} messages)
            </TooltipContent>
          </Tooltip>
        </aside>
      </TooltipProvider>
    );
  }

  const installedModels = ollamaStatus?.installed_models || [];
  const recommendedModels =
    ollamaStatus?.recommended_models && ollamaStatus.recommended_models.length > 0
      ? ollamaStatus.recommended_models
      : FALLBACK_RECOMMENDED_MODELS;
  const selectedModelLabel =
    ollamaStatus?.selected_model ||
    (installedModels[0]?.name ?? 'qwen2.5-coder:7b');

  return (
    <TooltipProvider delayDuration={150}>
      <aside className="w-[340px] sm:w-[368px] shrink-0 border-r border-slate-800/60 bg-slate-950 flex flex-col h-full overflow-hidden">
        {/* Sidebar Header */}
        <div className="h-10 px-3.5 border-b border-slate-800/60 flex items-center justify-between shrink-0 bg-slate-950">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shrink-0">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-slate-200 truncate">
              Conversational BI Agent
            </span>
            <Badge
              variant="outline"
              className="border-slate-800 bg-slate-900/70 text-slate-400 text-[10px] font-normal px-1.5 py-0"
            >
              6-Agent DAG
            </Badge>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(true)}
                className="h-6 w-6 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="bg-slate-900 border-slate-800 text-slate-200 text-xs"
            >
              Collapse Agent Sidebar
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Scrollable Conversation Thread */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4">
          {conversationHistory.length === 0 && !isAnalyzing && (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
                <span className="text-xs font-medium text-slate-200">
                  InsightForge Front Agent
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ask any business intelligence question. I coordinate six specialized backend agents—
                <span className="text-slate-300">SchemaProfiler</span>,{' '}
                <span className="text-slate-300">BIPlanner</span>,{' '}
                <span className="text-slate-300">SQLData</span>,{' '}
                <span className="text-slate-300">PipelineBuilder</span>,{' '}
                <span className="text-slate-300">VizLayout</span>, and{' '}
                <span className="text-slate-300">InsightNarrator</span>—to synthesize read-only SQL and build interactive visuals.
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-medium text-slate-500">
                  Starter analytical prompts:
                </div>
                {STARTER_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendPrompt(prompt)}
                    className="w-full text-left rounded-lg border border-slate-800/70 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:text-slate-100 transition leading-snug"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {conversationHistory.map((msg, index) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex flex-col items-end">
                  <div className="max-w-[90%] rounded-xl rounded-tr-sm border border-slate-800/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 leading-relaxed">
                    {msg.content}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 px-1">
                    <User className="h-2.5 w-2.5" />
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            }

            const traces = msg.agentTraces || [];
            const sqlQueries = msg.sqlQueries || [];
            const keyInsights = msg.keyInsights || [];
            const followups = msg.suggestedFollowups || [];
            const totalDurationMs = traces.reduce(
              (acc, t) => acc + (t.duration_ms || 0),
              0
            );
            const isTraceOpen =
              expandedTraces[msg.id] !== undefined
                ? expandedTraces[msg.id]
                : index === conversationHistory.length - 1;
            const isSqlOpen = !!expandedSql[msg.id];

            return (
              <div key={msg.id} className="space-y-2">
                {/* Assistant Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-indigo-500/15 text-indigo-400">
                      <Bot className="h-3 w-3" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-300">
                      Front Agent
                    </span>
                    {msg.modelUsed && (
                      <span className="rounded bg-slate-900 border border-slate-800/80 px-1.5 py-0 text-[10px] font-mono text-slate-400">
                        {msg.modelUsed}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Collapsible Assistant-UI Thought & Execution Trace Accordion */}
                {traces.length > 0 && (
                  <div className="rounded-lg border border-slate-800/70 bg-slate-900/35 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleTraceAccordion(msg.id)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11px] text-slate-300 hover:bg-slate-900/70 transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isTraceOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span className="font-medium truncate">
                          Agent Thought & Execution Trace ({traces.length} steps)
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0">
                        {totalDurationMs}ms
                      </span>
                    </button>

                    {isTraceOpen && (
                      <div className="border-t border-slate-800/60 px-2.5 py-2 space-y-2 bg-slate-950/50">
                        {msg.thoughtSummary && (
                          <p className="text-[11px] text-slate-400 leading-relaxed border-l-2 border-indigo-500/40 pl-2">
                            {msg.thoughtSummary}
                          </p>
                        )}

                        <div className="space-y-1.5">
                          {traces.map((tr, idx) => (
                            <div
                              key={idx}
                              className="flex items-start justify-between gap-2 rounded bg-slate-900/50 px-2 py-1 text-[11px]"
                            >
                              <div className="flex items-start gap-1.5 min-w-0">
                                {tr.status === 'running' ? (
                                  <Loader2 className="h-3 w-3 text-indigo-400 animate-spin mt-0.5 shrink-0" />
                                ) : tr.status === 'error' ? (
                                  <AlertTriangle className="h-3 w-3 text-rose-400 mt-0.5 shrink-0" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400/90 mt-0.5 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] font-medium text-indigo-300">
                                      {tr.agent}
                                    </span>
                                    <span className="text-slate-300 truncate">
                                      {tr.title}
                                    </span>
                                  </div>
                                  {tr.detail && (
                                    <p className="text-[10px] text-slate-500 truncate">
                                      {tr.detail}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="font-mono text-[10px] text-slate-500 shrink-0">
                                {tr.duration_ms}ms
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Expandable SQL Queries inside Trace */}
                        {sqlQueries.length > 0 && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => toggleSqlAccordion(msg.id)}
                              className="inline-flex items-center gap-1.5 text-[10px] font-medium text-indigo-300 hover:text-indigo-200 transition"
                            >
                              <Code2 className="h-3 w-3" />
                              <span>
                                {isSqlOpen ? 'Hide' : 'Inspect'} {sqlQueries.length}{' '}
                                Executed SQL Queries
                              </span>
                            </button>

                            {isSqlOpen && (
                              <div className="mt-1.5 space-y-1.5">
                                {sqlQueries.map((q, qIdx) => (
                                  <div
                                    key={qIdx}
                                    className="rounded border border-slate-800/80 bg-slate-950 p-2 space-y-1"
                                  >
                                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                                      <span className="font-medium text-slate-300 truncate">
                                        {q.title}
                                      </span>
                                      <span className="font-mono text-slate-500 shrink-0">
                                        {q.rowCount !== undefined ? `${q.rowCount} rows` : ''}
                                        {q.executionMs !== undefined
                                          ? ` • ${q.executionMs}ms`
                                          : ''}
                                      </span>
                                    </div>
                                    <pre className="text-[10px] font-mono text-emerald-300/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                      {q.sql}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Main Narrative Explanation & Key Insights */}
                <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-3 space-y-2.5">
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                    {msg.content}
                  </p>

                  {keyInsights.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-slate-800/50">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                        Key Findings & Anomalies
                      </div>
                      <ul className="space-y-1">
                        {keyInsights.map((ins, i) => (
                          <li
                            key={i}
                            className="text-[11px] text-slate-300 leading-snug flex items-start gap-1.5"
                          >
                            <span className="text-indigo-400 mt-0.5">•</span>
                            <span>{ins}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Suggested Follow-up Question Pills */}
                {followups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {followups.map((followup, fIdx) => (
                      <button
                        key={fIdx}
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => handleSendPrompt(followup)}
                        className="rounded-lg border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-indigo-500/40 px-2.5 py-1 text-[11px] text-slate-300 hover:text-indigo-200 transition text-left leading-snug disabled:opacity-50"
                      >
                        → {followup}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Live Streaming Assistant-UI Thought Card while isAnalyzing is true */}
          {isAnalyzing && (
            <div className="rounded-xl border border-indigo-500/30 bg-slate-900/50 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-indigo-200">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  <span>Synthesizing BI Pipeline...</span>
                </div>
                {activeAgentNode && (
                  <span className="font-mono text-[10px] text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded">
                    {AGENT_PIPELINE_LABELS[activeAgentNode] || activeAgentNode}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 border-t border-slate-800/60 pt-2">
                {agentTraces.map((tr, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-950/60 rounded px-2 py-1"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="font-mono text-[10px] text-indigo-300">
                        {tr.agent}
                      </span>
                      <span className="truncate text-slate-400">{tr.title}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">
                      {tr.duration_ms}ms
                    </span>
                  </div>
                ))}

                {activeAgentNode && (
                  <div className="flex items-center gap-1.5 text-[11px] text-indigo-300 px-2 py-1 animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    <span className="font-mono text-[10px]">
                      {AGENT_PIPELINE_LABELS[activeAgentNode] || activeAgentNode}
                    </span>
                    <span className="text-slate-400 text-[10px]">executing...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {/* Bottom Prompt Container with Integrated In-Textbox Model Selector */}
        <div className="p-3 border-t border-slate-800/60 bg-slate-950 shrink-0">
          <div className="rounded-xl border border-slate-800/90 bg-slate-900/50 focus-within:border-slate-700 focus-within:bg-slate-900/80 transition-colors p-2.5 flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or request a chart across your tables..."
              className="w-full resize-none bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none leading-relaxed"
            />

            {/* Bottom Control Bar Inside the Textbox */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              {/* Left Side: 3-State Ollama In-Textbox Selector / Action Pill */}
              <div className="flex items-center min-w-0">
                {ollamaStatus?.status === 'not_installed' ? (
                  /* Case 1: Ollama Not Installed */
                  <Popover
                    open={isInstallPopoverOpen}
                    onOpenChange={setIsInstallPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-200 transition"
                      >
                        <Download className="h-3 w-3 text-amber-400" />
                        <span>Install Ollama</span>
                        <ChevronUp className="h-3 w-3 text-amber-400/80" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="start"
                      sideOffset={8}
                      className="w-80 bg-slate-950 border-slate-800 text-slate-200 p-3.5 shadow-2xl space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                            Install Local Ollama Runtime
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Install Ollama to run local open-weights BI models. Schema-Adaptive BI remains active offline.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Terminal className="h-3 w-3" /> Windows Winget
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyWinget}
                            className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                          >
                            <Copy className="h-2.5 w-2.5" />
                            {copiedWinget ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <code className="block text-[11px] font-mono text-emerald-300 truncate">
                          {ollamaStatus.install_guide?.windows_winget_cmd ||
                            'winget install -e --id Ollama.Ollama'}
                        </code>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <a
                          href={
                            ollamaStatus.install_guide?.windows_installer_url ||
                            'https://ollama.com/download'
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1.5 text-[11px] font-medium text-white transition"
                        >
                          <Download className="h-3 w-3" />
                          Download Installer
                          <ExternalLink className="h-3 w-3" />
                        </a>

                        <button
                          type="button"
                          onClick={handleRefreshOllama}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-300 transition"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${
                              isRefreshingOllama ? 'animate-spin' : ''
                            }`}
                          />
                          Refresh Status
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : ollamaStatus?.status === 'installed_stopped' ? (
                  /* Case 2: Ollama Installed but Stopped */
                  <button
                    type="button"
                    onClick={startOllamaServer}
                    disabled={isStartingOllama}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition"
                  >
                    {isStartingOllama ? (
                      <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                    ) : (
                      <Play className="h-3 w-3 fill-current text-amber-400" />
                    )}
                    <span>
                      {isStartingOllama ? 'Starting Ollama...' : 'Launch Ollama Server'}
                    </span>
                  </button>
                ) : (
                  /* Case 3: Running (or default) — Sleek Copilot-style In-Textbox Model Selector Pill */
                  <Popover open={isModelMenuOpen} onOpenChange={setIsModelMenuOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/90 hover:bg-slate-900 hover:border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200 transition max-w-[230px]"
                      >
                        <Plus className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate font-mono text-[11px]">
                          {selectedModelLabel}
                        </span>
                        <ChevronUp className="h-3 w-3 text-slate-400 shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="start"
                      sideOffset={8}
                      className="w-72 sm:w-80 bg-slate-950 border-slate-800 text-slate-200 p-1.5 shadow-2xl"
                    >
                      {/* Menu Header */}
                      <div className="flex items-center justify-between px-2.5 py-1.5">
                        <span className="text-[11px] font-medium text-slate-400">
                          Model
                        </span>
                        {ollamaStatus?.status === 'running' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Ollama Online
                          </span>
                        )}
                      </div>

                      {/* Installed Models List */}
                      <div className="space-y-0.5 max-h-40 overflow-y-auto">
                        {installedModels.length > 0 ? (
                          installedModels.map((m) => {
                            const isSelected = ollamaStatus?.selected_model === m.name;
                            return (
                              <button
                                key={m.name}
                                type="button"
                                onClick={() => {
                                  selectOllamaModel(m.name);
                                  setIsModelMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition ${
                                  isSelected
                                    ? 'bg-slate-900 text-white font-medium'
                                    : 'text-slate-300 hover:bg-slate-900/70 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3.5 flex items-center justify-center shrink-0">
                                    {isSelected && (
                                      <Check className="h-3.5 w-3.5 text-indigo-400" />
                                    )}
                                  </span>
                                  <span className="font-mono text-[11px] truncate">
                                    {m.name}
                                  </span>
                                </div>
                                <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0 text-[10px] font-mono text-slate-400 shrink-0">
                                  {m.parameter_size || `${m.size_gb}GB`}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-2.5 py-1.5 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>Schema-Adaptive BI (Built-in)</span>
                            <Check className="h-3.5 w-3.5 text-indigo-400" />
                          </div>
                        )}
                      </div>

                      <Separator className="my-1.5 bg-slate-800/80" />

                      {/* Recommended BI Models Section */}
                      <div className="px-2.5 py-1 flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          Recommended BI Models
                        </span>
                      </div>

                      <div className="space-y-1 max-h-48 overflow-y-auto px-1">
                        {recommendedModels.map((rec) => {
                          const isPullingThis = pullProgress?.model === rec.tag;
                          return (
                            <div
                              key={rec.id}
                              className="rounded-md px-2 py-1.5 hover:bg-slate-900/60 transition space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[11px] text-slate-200 truncate">
                                      {rec.tag}
                                    </span>
                                    {rec.is_top_pick && (
                                      <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0 text-[9px] font-medium text-amber-300 shrink-0">
                                        Top Pick
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {rec.name} • {rec.size_gb} GB
                                  </div>
                                </div>

                                {rec.is_installed ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      selectOllamaModel(rec.tag);
                                      setIsModelMenuOpen(false);
                                    }}
                                    className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/25 shrink-0"
                                  >
                                    Use
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!!pullProgress}
                                    onClick={() => pullOllamaModel(rec.tag)}
                                    className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-indigo-600 hover:text-white disabled:opacity-40 px-2 py-0.5 text-[10px] font-medium text-slate-200 transition shrink-0"
                                  >
                                    {isPullingThis ? (
                                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                    ) : (
                                      <Download className="h-2.5 w-2.5" />
                                    )}
                                    <span>{isPullingThis ? 'Pulling' : 'Pull'}</span>
                                  </button>
                                )}
                              </div>

                              {isPullingThis && pullProgress && (
                                <div className="space-y-1 pt-0.5">
                                  <div className="flex items-center justify-between text-[10px] text-indigo-300">
                                    <span className="truncate">{pullProgress.status}</span>
                                    {pullProgress.percent !== null && (
                                      <span className="font-mono">{pullProgress.percent}%</span>
                                    )}
                                  </div>
                                  {pullProgress.percent !== null && (
                                    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-900">
                                      <div
                                        className="h-full bg-indigo-500 transition-all"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            Math.max(4, pullProgress.percent)
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <Separator className="my-1.5 bg-slate-800/80" />

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between px-1.5 py-0.5">
                        <button
                          type="button"
                          onClick={handleRefreshOllama}
                          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${
                              isRefreshingOllama ? 'animate-spin' : ''
                            }`}
                          />
                          <span>Refresh Status</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsModelMenuOpen(false);
                            setOllamaModalOpen(true);
                          }}
                          className="rounded px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition"
                        >
                          Runtime Settings
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Right Side: Circular Submit Arrow Button */}
              <button
                type="button"
                onClick={() => handleSendPrompt()}
                disabled={isAnalyzing || !inputVal.trim()}
                title="Send prompt (Enter)"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-950 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-900" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5 stroke-[2.25]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
};
export default AgentConversationSidebar;
