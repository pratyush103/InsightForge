import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Code,
  Copy,
  Download,
  FileCode2,
  GitBranch,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';

export const PipelineDrawer: React.FC = () => {
  const {
    manifest,
    savedPipelines,
    isPipelineDrawerOpen,
    setPipelineDrawerOpen,
    replayCurrentPipeline,
    loadPipeline,
    isAnalyzing,
  } = useDashboardStore();

  const [pythonCode, setPythonCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isPipelineDrawerOpen || !manifest) return null;

  const handleExportPython = async () => {
    const res = await fetch(`/api/pipelines/${manifest.pipeline_id}/export/python`);
    if (res.ok) {
      const code = await res.text();
      setPythonCode(code);
    }
  };

  const downloadManifestJson = () => {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manifest.pipeline_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 backdrop-blur-sm">
      <div className="w-full max-w-3xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Reproducible Analysis Pipeline DAG
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-mono text-emerald-300">
                  {manifest.pipeline_id}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Deterministic SQL & statistical steps verified with SHA-256 data lineage hashes.
              </p>
            </div>
          </div>

          <button
            onClick={() => setPipelineDrawerOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Schema:</span>
            <code className="font-mono text-indigo-300">{manifest.schema_fingerprint}</code>
            {manifest.last_replayed_at && (
              <span className="text-slate-500">
                • Replayed {new Date(manifest.last_replayed_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={replayCurrentPipeline}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition"
            >
              {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Replay Pipeline (Zero-LLM)
            </button>

            <button
              onClick={handleExportPython}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition"
            >
              <FileCode2 className="h-3.5 w-3.5 text-indigo-400" />
              Export .py Script
            </button>

            <button
              onClick={downloadManifestJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition"
            >
              <Download className="h-3.5 w-3.5" />
              Manifest JSON
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Exported Python Script Viewer */}
          {pythonCode && (
            <div className="rounded-xl border border-indigo-500/40 bg-slate-950 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Code className="h-4 w-4" /> Standalone Reproducible Python Pipeline
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pythonCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => setPythonCode(null)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Close
                  </button>
                </div>
              </div>
              <pre className="max-h-60 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-300">
                {pythonCode}
              </pre>
            </div>
          )}

          {/* Pipeline DAG Steps */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Deterministic Execution Steps ({manifest.steps.length})
            </h3>

            {manifest.steps.map((step) => (
              <div
                key={step.step_id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-500/30 font-mono text-xs font-bold text-indigo-300">
                      {step.step_number}
                    </span>
                    <span className="font-semibold text-sm text-slate-100">{step.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span>{step.row_count} rows</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-cyan-400" />
                      {step.execution_ms} ms
                    </span>
                    <span>•</span>
                    <span className="text-emerald-400">{step.output_hash}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-900/90 border border-slate-800/80 p-2.5 font-mono text-xs text-indigo-200 overflow-x-auto">
                  {step.executed_sql || step.sql_query}
                </div>

                {step.anomalies_detected.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {step.anomalies_detected.map((a, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-mono text-amber-300"
                      >
                        Outlier {a.direction}: {a.dimension_label} = {a.value.toLocaleString()} (Z={a.z_score})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Saved Pipeline History */}
          {savedPipelines.length > 1 && (
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-indigo-400" />
                Saved Reproducible Pipeline Snapshots ({savedPipelines.length})
              </h3>
              <div className="space-y-2">
                {savedPipelines.map((p) => (
                  <button
                    key={p.pipeline_id}
                    onClick={() => loadPipeline(p.pipeline_id)}
                    className={`w-full text-left rounded-xl border p-3 transition flex items-center justify-between ${
                      p.pipeline_id === manifest.pipeline_id
                        ? 'border-indigo-500 bg-indigo-500/15'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-100">{p.title}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-md">{p.user_query}</div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-slate-400">
                      <div className="text-indigo-300">{p.dialect.toUpperCase()}</div>
                      <div>{p.step_count} steps</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
