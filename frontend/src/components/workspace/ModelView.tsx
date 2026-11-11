import React, { useState } from 'react';
import {
  GitBranch,
  ShieldCheck,
  Clock,
  Code,
  Copy,
  Download,
  FileCode2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Database,
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';

export const ModelView: React.FC = () => {
  const { manifest, replayCurrentPipeline, isAnalyzing } = useDashboardStore();
  const [pythonCode, setPythonCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!manifest) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-canvas text-center select-none">
        <div className="max-w-md bg-white border border-line rounded p-8 space-y-3 shadow-page">
          <GitBranch className="h-8 w-8 text-focus mx-auto" />
          <h2 className="text-base font-semibold text-ink">No Pipeline Lineage Yet</h2>
          <p className="text-xs text-muted leading-relaxed">
            Generate or replay a report to view deterministic SQL extraction steps, schema fingerprints, and SHA-256 data hashes.
          </p>
        </div>
      </div>
    );
  }

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
    <div className="flex-1 overflow-y-auto bg-canvas p-6 select-none text-xs">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Model Header */}
        <div className="bg-white border border-line rounded p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-ink">{manifest.title}</span>
              <span className="rounded bg-focus-tint border border-focus/30 px-2 py-0.5 text-2xs font-mono font-medium text-focus">
                {manifest.pipeline_id}
              </span>
            </div>
            <div className="flex items-center gap-3 text-2xs text-muted font-mono">
              <span className="flex items-center gap-1">
                <Database className="h-3 w-3" /> {manifest.connector_name} ({manifest.dialect.toUpperCase()})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-good" /> Fingerprint: {manifest.schema_fingerprint}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={replayCurrentPipeline}
              disabled={isAnalyzing}
              className="h-8 px-3 rounded bg-focus hover:bg-[#0c5a9e] disabled:opacity-40 text-white font-semibold flex items-center gap-1.5 transition text-xs"
            >
              {isAnalyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>Replay Lineage</span>
            </button>

            <button
              onClick={handleExportPython}
              className="h-8 px-3 rounded border border-line-strong bg-white hover:bg-hover text-ink font-semibold flex items-center gap-1.5 transition text-xs"
            >
              <FileCode2 className="h-3.5 w-3.5 text-focus" />
              <span>Export .py</span>
            </button>

            <button
              onClick={downloadManifestJson}
              className="h-8 px-2.5 rounded border border-line bg-white hover:bg-hover text-muted hover:text-ink transition"
              title="Download Manifest JSON"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Python script export modal/card */}
        {pythonCode && (
          <div className="bg-white border border-line-strong rounded p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink flex items-center gap-1.5">
                <Code className="h-4 w-4 text-focus" /> Standalone Python Pipeline Script
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pythonCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="h-6 px-2 rounded border border-line bg-white hover:bg-hover text-2xs text-ink flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => setPythonCode(null)}
                  className="text-2xs text-muted hover:text-ink font-medium"
                >
                  Close
                </button>
              </div>
            </div>
            <pre className="max-h-64 overflow-auto rounded bg-[#faf9f8] border border-line p-3 font-mono text-2xs text-ink">
              {pythonCode}
            </pre>
          </div>
        )}

        {/* Pipeline Steps DAG */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            Deterministic Pipeline Steps ({manifest.steps.length})
          </h2>

          <div className="space-y-3">
            {manifest.steps.map((step) => (
              <div
                key={step.step_id}
                className="bg-white border border-line rounded p-4 space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-focus text-white font-mono text-2xs font-bold flex items-center justify-center">
                      {step.step_number}
                    </span>
                    <span className="font-semibold text-xs text-ink">{step.title}</span>
                  </div>

                  <div className="flex items-center gap-3 text-2xs font-mono text-muted">
                    <span className="tnum">{step.row_count} rows</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted" />
                      <span className="tnum">{step.execution_ms} ms</span>
                    </span>
                    <span>•</span>
                    <span className="text-good font-semibold">{step.output_hash.slice(0, 10)}</span>
                  </div>
                </div>

                {/* SQL snippet */}
                <div className="rounded bg-[#faf9f8] border border-line p-2.5 font-mono text-2xs text-ink overflow-x-auto leading-relaxed">
                  {step.executed_sql || step.sql_query}
                </div>

                {/* Statistical anomalies */}
                {step.anomalies_detected.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {step.anomalies_detected.map((a, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-[#fff9e6] border border-[#c19c00]/40 px-2 py-0.5 text-2xs font-mono text-warn flex items-center gap-1"
                      >
                        <AlertCircle className="h-3 w-3" />
                        Outlier {a.direction}: {a.dimension_label} = {a.value.toLocaleString()} (Z={a.z_score})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
