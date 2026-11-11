import React from 'react';
import { Database, FileSpreadsheet, Sparkles, Send, ArrowRight } from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { HardDrive } from '../linework/harddrive';
import { BrandMark } from '../ui/primitives';

export const EmptyCanvas: React.FC = () => {
  const { openGetData, openSampleDataset, setPromptInput, runAnalysis, promptInput } = useDashboardStore();

  const handleQuickAsk = (q: string) => {
    setPromptInput(q);
    runAnalysis(q);
  };

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-canvas select-none">
      <div className="w-full max-w-4xl bg-white rounded border border-line shadow-page p-8 md:p-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-line pb-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <BrandMark size={22} />
              <h1 className="text-xl font-bold text-ink tracking-tight">InsightForge</h1>
              <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-[#f3f2f1] border border-line text-muted">
                Power BI Architecture
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Build executive reports and data pipelines from SQLite, MySQL, and Microsoft SQL Server.
              Connect your database or ask an analytical question in plain English.
            </p>
          </div>

          {/* Linework Illustration Metaphor */}
          <div className="w-44 h-36 shrink-0 hidden md:block">
            <HardDrive readout={false} tour={true} label="Data storage and pipeline illustration" />
          </div>
        </div>

        {/* 3 Core Starting Workflows */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Connect Database */}
          <div className="border border-line rounded p-4 flex flex-col justify-between hover:border-line-strong hover:shadow-sm transition">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-focus-tint border border-focus/20 flex items-center justify-center text-focus">
                <Database className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-ink">Connect to SQL Database</h2>
              <p className="text-xs text-muted leading-snug">
                Introspect schema, tables, and foreign keys from SQLite, MySQL, or SQL Server.
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => openGetData('sqlite')}
                className="w-full h-8 rounded bg-white border border-line-strong hover:bg-hover text-xs font-semibold text-ink transition flex items-center justify-center gap-1.5"
              >
                <span>Select Connector</span>
                <ArrowRight className="h-3 w-3 text-muted" />
              </button>
            </div>
          </div>

          {/* Card 2: Import CSV */}
          <div className="border border-line rounded p-4 flex flex-col justify-between hover:border-line-strong hover:shadow-sm transition">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-[#f1faf1] border border-good/20 flex items-center justify-center text-good">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-ink">Import CSV File</h2>
              <p className="text-xs text-muted leading-snug">
                Upload any comma-separated spreadsheet to mount as an indexed SQL table.
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => openGetData('csv')}
                className="w-full h-8 rounded bg-white border border-line-strong hover:bg-hover text-xs font-semibold text-ink transition flex items-center justify-center gap-1.5"
              >
                <span>Upload CSV</span>
                <ArrowRight className="h-3 w-3 text-muted" />
              </button>
            </div>
          </div>

          {/* Card 3: Optional Sample Dataset */}
          <div className="border border-line rounded p-4 flex flex-col justify-between hover:border-line-strong hover:shadow-sm transition">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-[#fff9e6] border border-[#c19c00]/30 flex items-center justify-center text-warn">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-ink">Try Sample Data</h2>
              <p className="text-xs text-muted leading-snug">
                Explore a pre-seeded 6-table SaaS & Global Commerce database with orders and churn.
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={openSampleDataset}
                className="w-full h-8 rounded bg-white border border-line-strong hover:bg-hover text-xs font-semibold text-ink transition flex items-center justify-center gap-1.5"
              >
                <span>Load Sample</span>
                <ArrowRight className="h-3 w-3 text-muted" />
              </button>
            </div>
          </div>
        </div>

        {/* Or ask a prompt directly */}
        <div className="bg-[#faf9f8] border border-line rounded p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">Ask a Question (Natural Language Q&A)</span>
            <span className="text-2xs text-muted">Powered by LangGraph multi-agent pipeline</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="e.g. 'Analyze revenue by region, margins, and customer retention'..."
              className="flex-1 h-9 rounded border border-line-strong bg-white px-3 text-xs text-ink placeholder:text-muted focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && promptInput.trim()) {
                  runAnalysis(promptInput);
                }
              }}
            />
            <button
              onClick={() => {
                if (promptInput.trim()) runAnalysis(promptInput);
              }}
              disabled={!promptInput.trim()}
              className="h-9 px-4 rounded bg-focus hover:bg-[#0c5a9e] disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Generate Report</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-2xs">
            <span className="text-muted font-medium">Sample Questions:</span>
            {[
              'Analyze executive revenue trajectory and profit margins',
              'Analyze SaaS churn reasons, ARR exposure, and health score',
              'Evaluate marketing attribution funnel and campaign conversions',
            ].map((q) => (
              <button
                key={q}
                onClick={() => handleQuickAsk(q)}
                className="rounded border border-line bg-white hover:bg-hover px-2 py-1 text-muted hover:text-ink transition"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
