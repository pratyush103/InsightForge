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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 select-none">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded bg-white border border-line-strong shadow-dialog flex flex-col text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-focus-tint border border-focus/20 flex items-center justify-center text-focus">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                Local Ollama AI Engine & SQL Models
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-semibold ${
                    ollamaStatus.status === 'running'
                      ? 'bg-[#f1faf1] text-good border border-good/30'
                      : ollamaStatus.status === 'installed_stopped'
                      ? 'bg-[#fff9e6] text-warn border border-[#c19c00]/30'
                      : 'bg-[#fdf3f4] text-bad border border-bad/30'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      ollamaStatus.status === 'running'
                        ? 'bg-good'
                        : ollamaStatus.status === 'installed_stopped'
                        ? 'bg-warn'
                        : 'bg-bad'
                    }`}
                  />
                  {ollamaStatus.status === 'running'
                    ? 'Online'
                    : ollamaStatus.status === 'installed_stopped'
                    ? 'Installed (Server Stopped)'
                    : 'Not Detected'}
                </span>
              </h2>
              <p className="text-2xs text-muted">
                Run local open-weights LLMs for zero-cost, private SQL compilation and BI narration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 h-7 rounded border border-line bg-white px-2.5 text-2xs font-medium text-ink hover:bg-hover transition"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              Re-Detect
            </button>
            <button
              onClick={() => setOllamaModalOpen(false)}
              className="rounded p-1 text-muted hover:bg-hover hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* System Detection Banner */}
          {ollamaStatus.status === 'installed_stopped' && (
            <div className="rounded border border-[#c19c00]/40 bg-[#fff9e6] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-warn font-semibold text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Ollama is Installed, but Background Daemon is Stopped
                </div>
                <p className="text-2xs text-ink">
                  Binary found at{' '}
                  <code className="font-mono bg-white px-1 py-0.5 rounded border border-line">
                    {ollamaStatus.binary_path || 'ollama'}
                  </code>
                </p>
                <p className="text-2xs text-muted">
                  Click Launch Server to start the daemon on{' '}
                  <code className="font-mono text-ink">{ollamaStatus.base_url}</code>.
                </p>
              </div>
              <button
                onClick={startOllamaServer}
                disabled={isStartingOllama}
                className="shrink-0 inline-flex items-center gap-1.5 h-8 rounded bg-focus hover:bg-[#0c5a9e] disabled:opacity-40 px-3.5 text-xs font-semibold text-white transition shadow-sm"
              >
                {isStartingOllama ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Launch Server
                  </>
                )}
              </button>
            </div>
          )}

          {ollamaStatus.status === 'not_installed' && (
            <div className="rounded border border-bad/30 bg-[#fdf3f4] p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-bad font-semibold text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Ollama is not installed on this machine
                  </div>
                  <p className="text-2xs text-muted leading-relaxed">
                    InsightForge automatically falls back to its built-in schema-adaptive BI heuristics engine when Ollama is offline.
                  </p>
                </div>
                <a
                  href={ollamaStatus.install_guide.windows_installer_url || 'https://ollama.com/download'}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-1.5 h-8 rounded bg-focus hover:bg-[#0c5a9e] px-3.5 text-xs font-semibold text-white transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Installer Download
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="rounded border border-line bg-white p-2.5">
                <div className="text-2xs font-semibold text-muted mb-1 flex items-center justify-between">
                  <span>Terminal Install (Windows Winget)</span>
                  <button
                    onClick={() =>
                      copyText(ollamaStatus.install_guide.windows_winget_cmd || 'winget install -e --id Ollama.Ollama')
                    }
                    className="text-focus hover:underline inline-flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    {copiedCmd?.includes('winget') ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <code className="text-2xs font-mono text-ink">
                  {ollamaStatus.install_guide.windows_winget_cmd || 'winget install -e --id Ollama.Ollama'}
                </code>
              </div>
            </div>
          )}

          {/* Active Download Progress Bar */}
          {pullProgress && (
            <div className="rounded border border-focus/30 bg-focus-tint p-3 space-y-1.5">
              <div className="flex items-center justify-between text-2xs">
                <span className="font-semibold text-focus flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Downloading <code className="font-mono">{pullProgress.model}</code>: {pullProgress.status}
                </span>
                {pullProgress.percent !== null && (
                  <span className="font-mono font-bold text-focus">{pullProgress.percent}%</span>
                )}
              </div>
              {pullProgress.percent !== null && (
                <div className="h-1.5 w-full overflow-hidden rounded bg-line">
                  <div
                    className="h-full bg-focus transition-[width] duration-300"
                    style={{ width: `${Math.min(100, Math.max(2, pullProgress.percent))}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Installed Models */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-2xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-focus" />
                Installed Local Models ({ollamaStatus.installed_models.length})
              </h3>
              <span className="text-2xs text-muted font-mono">{ollamaStatus.base_url}</span>
            </div>

            {ollamaStatus.installed_models.length === 0 ? (
              <div className="rounded border border-line bg-[#faf9f8] p-4 text-center text-2xs text-muted">
                {ollamaStatus.status === 'running'
                  ? 'No local models downloaded yet. Click "Pull Model" on any curated model below.'
                  : 'Start or install Ollama above to inspect local models.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {ollamaStatus.installed_models.map((m) => {
                  const isSelected = ollamaStatus.selected_model === m.name;
                  return (
                    <button
                      key={m.name}
                      onClick={() => selectOllamaModel(m.name)}
                      className={`text-left rounded border p-3 transition flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'border-focus bg-focus-tint shadow-2xs'
                          : 'border-line bg-white hover:bg-hover'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="font-mono text-xs font-semibold text-ink truncate">{m.name}</div>
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#f1faf1] px-1.5 py-0.2 text-[10px] font-semibold text-good border border-good/30">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Active
                          </span>
                        ) : (
                          <span className="text-2xs text-muted">Select</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-2xs text-muted font-mono">
                        <span>{m.size_gb} GB</span>
                        {m.parameter_size && <span>• {m.parameter_size}</span>}
                        {m.is_running && (
                          <span className="ml-auto inline-flex items-center gap-1 text-good font-semibold">
                            <Activity className="h-2.5 w-2.5" /> Loaded
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Curated SQL Models */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-2xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-brand" />
                  Recommended SQL & BI Models
                </h3>
                <p className="text-2xs text-muted">
                  Open-weights models tested for SQLite, MySQL, and T-SQL synthesis.
                </p>
              </div>

              {/* Custom tag pull */}
              <form onSubmit={handleCustomPull} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={customModelTag}
                  onChange={(e) => setCustomModelTag(e.target.value)}
                  placeholder="Custom tag (e.g. mistral:7b)"
                  className="h-7 w-44 rounded border border-line-strong bg-white px-2 text-2xs text-ink font-mono focus:border-focus focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!customModelTag.trim() || !!pullProgress}
                  className="h-7 px-2.5 rounded border border-line-strong bg-white hover:bg-hover text-ink text-2xs font-semibold transition"
                >
                  Pull
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ollamaStatus.recommended_models.map((rec) => (
                <div
                  key={rec.id}
                  className={`rounded border p-3.5 flex flex-col justify-between gap-2.5 bg-white ${
                    rec.is_top_pick ? 'border-focus/50 shadow-2xs' : 'border-line'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-ink">{rec.name}</span>
                          {rec.is_top_pick && (
                            <span className="rounded bg-[#fff9e6] border border-[#c19c00]/30 px-1.5 py-0.2 text-[10px] font-semibold text-warn">
                              Top Pick
                            </span>
                          )}
                        </div>
                        <code className="text-2xs font-mono text-focus">{rec.tag}</code>
                      </div>
                      <div className="text-right text-2xs text-muted font-mono">
                        <div>{rec.size_gb} GB</div>
                        <div>Min {rec.min_ram_gb}GB RAM</div>
                      </div>
                    </div>

                    <p className="text-2xs text-muted leading-relaxed">{rec.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-line">
                    <span className="text-2xs text-subtle truncate max-w-[200px]">{rec.recommended_for}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => copyText(`ollama pull ${rec.tag}`)}
                        title="Copy command"
                        className="rounded p-1 border border-line bg-white hover:bg-hover text-muted hover:text-ink"
                      >
                        <Terminal className="h-3 w-3" />
                      </button>

                      {rec.is_installed ? (
                        <button
                          onClick={() => selectOllamaModel(rec.tag)}
                          className="h-6 px-2.5 rounded bg-[#f1faf1] border border-good/30 text-good text-2xs font-semibold hover:bg-[#e4f7e4] transition"
                        >
                          Use
                        </button>
                      ) : (
                        <button
                          onClick={() => pullOllamaModel(rec.tag)}
                          disabled={!!pullProgress}
                          className="h-6 px-2.5 rounded bg-focus hover:bg-[#0c5a9e] text-white text-2xs font-semibold transition"
                        >
                          Pull
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
