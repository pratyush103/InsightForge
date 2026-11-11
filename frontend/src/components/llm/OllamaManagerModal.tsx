import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';

export const OllamaManagerModal: React.FC = () => {
  const {
    ollamaStatus,
    isOllamaModalOpen,
    setOllamaModalOpen,
    fetchOllamaStatus,
    startOllamaServer,
    isStartingOllama,
    selectOllamaModel,
    pullOllamaModel,
    pullProgress,
  } = useDashboardStore();

  const [customModelTag, setCustomModelTag] = useState('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOllamaModalOpen || !ollamaStatus) return null;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOllamaStatus();
    setIsRefreshing(false);
  };

  const handleCustomPull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customModelTag.trim()) return;
    await pullOllamaModel(customModelTag.trim());
    setCustomModelTag('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Local Ollama Runtime & Model Hub
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    ollamaStatus.status === 'running'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : ollamaStatus.status === 'installed_stopped'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      ollamaStatus.status === 'running'
                        ? 'bg-emerald-400 animate-pulse'
                        : ollamaStatus.status === 'installed_stopped'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />
                  {ollamaStatus.status === 'running'
                    ? 'Server Running'
                    : ollamaStatus.status === 'installed_stopped'
                    ? 'Installed (Server Stopped)'
                    : 'Not Installed'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Auto-detects local Ollama installation, manages daemon lifecycle, and provisions recommended SQL/BI models.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Re-Detect
            </button>
            <button
              onClick={() => setOllamaModalOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* System Detection Banner */}
          {ollamaStatus.status === 'installed_stopped' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-300 font-medium text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Ollama is Installed on Your System, but the Server is Not Running
                </div>
                <p className="text-xs text-slate-300">
                  Detected binary:{' '}
                  <code className="rounded bg-slate-950/70 px-1.5 py-0.5 font-mono text-amber-200">
                    {ollamaStatus.binary_path || 'ollama'}
                  </code>{' '}
                  {ollamaStatus.cli_version && <span>({ollamaStatus.cli_version})</span>}
                </p>
                <p className="text-xs text-slate-400">
                  Click <strong>Launch Ollama Server</strong> below to start the background service on{' '}
                  <code className="font-mono">{ollamaStatus.base_url}</code>, or run{' '}
                  <code className="font-mono text-slate-200">ollama serve</code> in your terminal.
                </p>
              </div>
              <button
                onClick={startOllamaServer}
                disabled={isStartingOllama}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition"
              >
                {isStartingOllama ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting Daemon...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Launch Ollama Server
                  </>
                )}
              </button>
            </div>
          )}

          {ollamaStatus.status === 'not_installed' && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Ollama Not Detected on This System
                  </div>
                  <p className="text-xs text-slate-300">
                    InsightForge uses Ollama to run local open-weights LLMs for private, zero-cost SQL generation and executive BI narration.
                    (While Ollama is offline, InsightForge automatically uses its built-in Schema-Adaptive BI Engine so you can still explore dashboards.)
                  </p>
                </div>
                <a
                  href={ollamaStatus.install_guide.windows_installer_url || 'https://ollama.com/download'}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition"
                >
                  <Download className="h-4 w-4" />
                  Download Ollama Installer
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                  <div className="text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                    <span>Option 1: Install via Windows Winget</span>
                    <button
                      onClick={() =>
                        copyText(ollamaStatus.install_guide.windows_winget_cmd || 'winget install -e --id Ollama.Ollama')
                      }
                      className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedCmd?.includes('winget') ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <code className="text-xs font-mono text-emerald-300">
                    {ollamaStatus.install_guide.windows_winget_cmd || 'winget install -e --id Ollama.Ollama'}
                  </code>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                  <div className="text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                    <span>Option 2: Start Server & Pull Recommended Model</span>
                    <button
                      onClick={() => copyText('ollama pull qwen2.5-coder:7b')}
                      className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedCmd?.includes('qwen') ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <code className="text-xs font-mono text-indigo-300">ollama pull qwen2.5-coder:7b</code>
                </div>
              </div>
            </div>
          )}

          {/* Active Download Progress Bar */}
          {pullProgress && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-indigo-200 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  Pulling <code className="font-mono font-semibold">{pullProgress.model}</code> — {pullProgress.status}
                </span>
                {pullProgress.percent !== null && (
                  <span className="font-mono font-semibold text-indigo-300">{pullProgress.percent}%</span>
                )}
              </div>
              {pullProgress.percent !== null && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(2, pullProgress.percent))}%` }}
                  />
                </div>
              )}
              {pullProgress.error && (
                <p className="text-xs text-rose-400 font-medium">{pullProgress.error}</p>
              )}
            </div>
          )}

          {/* Installed Models Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <HardDrive className="h-3.5 w-3.5 text-indigo-400" />
                Installed Local Models ({ollamaStatus.installed_models.length})
              </h3>
              <span className="text-xs text-slate-500 font-mono">Endpoint: {ollamaStatus.base_url}</span>
            </div>

            {ollamaStatus.installed_models.length === 0 ? (
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-center text-xs text-slate-400">
                {ollamaStatus.status === 'running'
                  ? 'No local models installed yet. Click "Pull Model" on any recommended model below to download it.'
                  : 'Start or install Ollama above to inspect locally installed models.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ollamaStatus.installed_models.map((m) => {
                  const isSelected = ollamaStatus.selected_model === m.name;
                  return (
                    <button
                      key={m.name}
                      onClick={() => selectOllamaModel(m.name)}
                      className={`text-left rounded-xl border p-3.5 transition flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/15 shadow-lg shadow-indigo-500/10'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-mono text-xs font-semibold text-slate-100 truncate">{m.name}</div>
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Select</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{m.size_gb} GB</span>
                        {m.parameter_size && <span>• {m.parameter_size}</span>}
                        {m.quantization_level && <span>• {m.quantization_level}</span>}
                        {m.is_running && (
                          <span className="ml-auto inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <Activity className="h-3 w-3" /> Loaded
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Curated Recommended Models Catalog */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Recommended Models for SQL & BI Generation
                </h3>
                <p className="text-xs text-slate-500">
                  Benchmark-selected open models optimized for SQLite, MySQL, and MS SQL Server (T-SQL) query synthesis.
                </p>
              </div>

              {/* Custom Model Pull Form */}
              <form onSubmit={handleCustomPull} className="flex items-center gap-2">
                <input
                  type="text"
                  value={customModelTag}
                  onChange={(e) => setCustomModelTag(e.target.value)}
                  placeholder="Pull custom tag (e.g. mistral:7b)"
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none font-mono w-56"
                />
                <button
                  type="submit"
                  disabled={!customModelTag.trim() || !!pullProgress}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-slate-200 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Pull
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {ollamaStatus.recommended_models.map((rec) => (
                <div
                  key={rec.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition ${
                    rec.is_top_pick
                      ? 'border-indigo-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-100">{rec.name}</span>
                          {rec.is_top_pick && (
                            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              ★ Top Pick
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs font-mono text-indigo-400">{rec.tag}</code>
                          <span className="text-[11px] text-slate-500">• {rec.category}</span>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400 shrink-0">
                        <div className="font-mono font-medium text-slate-300">{rec.size_gb} GB</div>
                        <div>Min {rec.min_ram_gb}GB RAM</div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{rec.description}</p>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {rec.strengths.map((str) => (
                        <span
                          key={str}
                          className="rounded-md bg-slate-800/90 border border-slate-700/70 px-2 py-0.5 text-[10px] text-slate-300"
                        >
                          {str}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400">{rec.recommended_for}</span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyText(`ollama pull ${rec.tag}`)}
                        title="Copy terminal command"
                        className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      >
                        <Terminal className="h-3.5 w-3.5" />
                      </button>

                      {rec.is_installed ? (
                        <button
                          onClick={() => selectOllamaModel(rec.tag)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Installed (Use)
                        </button>
                      ) : (
                        <button
                          onClick={() => pullOllamaModel(rec.tag)}
                          disabled={!!pullProgress}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Pull Model
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
