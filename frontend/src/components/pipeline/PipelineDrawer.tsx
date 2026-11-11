import React, { useState } from 'react';
import {
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
  AlertCircle,
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 select-none text-xs">
      <div className="w-full max-w-2xl h-full bg-white border-l border-line-strong shadow-dialog flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-focus-tint border border-focus/20 flex items-center justify-center text-focus">
              <GitBranch className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-ink flex items-center gap-1.5">
                Reproducible Pipeline DAG
                <span className="font-mono text-2xs text-muted">({manifest.pipeline_id})</span>
              </h2>
              <p className="text-2xs text-muted">
                SHA-256 data lineage hashes & SQL execution steps
              </p>
            </div>
          </div>

          <button
            onClick={() => setPipelineDrawerOpen(false)}
            className="rounded p-1 text-muted hover:bg-hover hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between gap-2 border-b border-line bg-[#faf9f8] px-5 py-2">
          <div className="flex items-center gap-1.5 text-2xs text-muted font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-good" />
            <span>Fingerprint: {manifest.schema_fingerprint}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={replayCurrentPipeline}
              disabled={isAnalyzing}
              className="h-7 px-2.5 rounded bg-focus hover:bg-[#0c5a9e] disabled:opacity-40 text-white font-semibold flex items-center gap-1 transition text-2xs"
            >
              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Replay Pipeline
            </button>

            <button
              onClick={handleExportPython}
              className="h-7 px-2.5 rounded border border-line-strong bg-white hover:bg-hover text-ink font-semibold flex items-center gap-1 transition text-2xs"
            >
              <FileCode2 className="h-3 w-3 text-focus" />
              Python Script
            </button>

            <button
              onClick={downloadManifestJson}
              className="h-7 px-2 rounded border border-line bg-white hover:bg-hover text-muted hover:text-ink transition"
              title="Download JSON"
            >
              <Download className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {pythonCode && (
            <div className="rounded border border-line bg-[#faf9f8] p-3 space-y-2">
              <div className="flex items-center justify-between text-2xs">
                <span className="font-semibold text-ink flex items-center gap-1">
                  <Code className="h-3 w-3 text-focus" /> Standalone Python Pipeline
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pythonCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="h-5 px-1.5 rounded border border-line bg-white text-ink text-[10px] flex items-center gap-1"
                  >
                    <Copy className="h-2.5 w-2.5" /> {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => setPythonCode(null)}
                    className="text-[10px] text-muted hover:text-ink"
                  >
                    Close
                  </button>
                </div>
              </div>
              <pre className="max-h-52 overflow-auto rounded bg-white border border-line p-2.5 font-mono text-2xs text-ink">
                {pythonCode}
              </pre>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-2.5">
            <h3 className="text-2xs font-bold uppercase tracking-wider text-muted">
              Steps ({manifest.steps.length})
            </h3>

            {manifest.steps.map((step) => (
              <div
                key={step.step_id}
                className="rounded border border-line bg-white p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-focus text-white font-mono text-2xs font-bold flex items-center justify-center">
                      {step.step_number}
                    </span>
                    <span className="font-semibold text-xs text-ink">{step.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-2xs font-mono text-muted">
                    <span className="tnum">{step.row_count} rows</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      <span className="tnum">{step.execution_ms}ms</span>
                    </span>
                    <span>•</span>
                    <span className="text-good">{step.output_hash.slice(0, 8)}</span>
                  </div>
                </div>

                <div className="rounded bg-[#faf9f8] border border-line p-2 font-mono text-2xs text-ink overflow-x-auto">
                  {step.executed_sql || step.sql_query}
                </div>

                {step.anomalies_detected.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {step.anomalies_detected.map((a, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-[#fff9e6] border border-[#c19c00]/30 px-1.5 py-0.2 text-[10px] font-mono text-warn flex items-center gap-1"
                      >
                        <AlertCircle className="h-2.5 w-2.5" />
                        Outlier {a.direction}: {a.dimension_label} = {a.value.toLocaleString()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Saved History */}
          {savedPipelines.length > 1 && (
            <div className="space-y-2 pt-3 border-t border-line">
              <h3 className="text-2xs font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                <History className="h-3 w-3" />
                Saved Pipelines ({savedPipelines.length})
              </h3>
              <div className="space-y-1.5">
                {savedPipelines.map((p) => (
                  <button
                    key={p.pipeline_id}
                    onClick={() => loadPipeline(p.pipeline_id)}
                    className={`w-full text-left rounded border p-2.5 transition flex items-center justify-between ${
                      p.pipeline_id === manifest.pipeline_id
                        ? 'border-focus bg-focus-tint/50 font-semibold'
                        : 'border-line bg-white hover:bg-hover'
                    }`}
                  >
                    <div>
                      <div className="text-xs text-ink">{p.title}</div>
                      <div className="text-2xs text-muted truncate max-w-sm">{p.user_query}</div>
                    </div>
                    <div className="text-right font-mono text-2xs text-muted">
                      <div>{p.dialect.toUpperCase()}</div>
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
