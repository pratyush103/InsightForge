import React, { useEffect, useState } from 'react';
import { Code2, Loader2, Play, ShieldCheck, X } from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { ChartArchetype } from '../../types/insightforge';

const ALL_CHART_TYPES: { id: ChartArchetype; label: string }[] = [
  { id: 'grouped_bar', label: 'Clustered Column / Bar' },
  { id: 'stacked_bar', label: 'Stacked Bar' },
  { id: 'horizontal_bar', label: 'Horizontal Ranking Bar' },
  { id: 'multi_line', label: 'Line Chart' },
  { id: 'area_spline', label: 'Area Chart' },
  { id: 'combo_dual_axis', label: 'Combo Chart (Dual Axis)' },
  { id: 'donut', label: 'Donut Chart' },
  { id: 'rose', label: 'Nightingale Rose Chart' },
  { id: 'kpi', label: 'KPI Card' },
  { id: 'table', label: 'Data Table' },
  { id: 'geo_map', label: 'Geographic World Map' },
  { id: 'funnel', label: 'Conversion Funnel' },
  { id: 'heatmap', label: '2D Matrix Heatmap' },
  { id: 'sankey', label: 'Sankey Attribution Flow' },
  { id: 'radar', label: 'Radar Chart' },
  { id: 'treemap', label: 'Treemap' },
  { id: 'scatter', label: 'Scatter Plot' },
];

export const WidgetInspectorModal: React.FC = () => {
  const { editingWidget, setEditingWidget, mutateWidget } = useDashboardStore();
  const [title, setTitle] = useState('');
  const [chartType, setChartType] = useState<ChartArchetype>('grouped_bar');
  const [sqlQuery, setSqlQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingWidget) {
      setTitle(editingWidget.title);
      setChartType(editingWidget.chart_type);
      setSqlQuery(editingWidget.sql_query);
      setError(null);
    }
  }, [editingWidget]);

  if (!editingWidget) return null;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await mutateWidget(editingWidget, {
        newTitle: title,
        newChartType: chartType,
        newSqlQuery: sqlQuery,
      });
      setEditingWidget(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 select-none">
      <div className="w-full max-w-2xl rounded bg-white border border-line-strong shadow-dialog overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-white">
          <div className="flex items-center gap-2.5">
            <Code2 className="h-4 w-4 text-focus" />
            <div>
              <h3 className="font-semibold text-sm text-ink">
                Format Visual & Inspect SQL Lineage
              </h3>
              <p className="text-2xs text-muted font-mono">
                Step: {editingWidget.step_id} • Hash: {editingWidget.data_hash}
              </p>
            </div>
          </div>

          <button
            onClick={() => setEditingWidget(null)}
            className="rounded p-1 text-muted hover:bg-hover hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-5 space-y-4">
          {error && (
            <div className="rounded border border-bad/40 bg-[#fdf3f4] p-2.5 text-xs text-bad font-mono">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-semibold text-muted mb-1">Visual Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-8 rounded border border-line-strong bg-white px-2.5 text-xs text-ink focus:border-focus focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold text-muted mb-1">
                Visual Archetype
              </label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartArchetype)}
                className="w-full h-8 rounded border border-line-strong bg-white px-2.5 text-xs text-ink focus:border-focus focus:outline-none"
              >
                {ALL_CHART_TYPES.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-2xs font-semibold text-muted">
                Underlying Read-Only SQL Query
              </label>
              <span className="inline-flex items-center gap-1 text-2xs text-good font-medium">
                <ShieldCheck className="h-3 w-3" /> SQLGlot AST Protected
              </span>
            </div>
            <textarea
              rows={5}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full rounded border border-line-strong bg-[#faf9f8] p-2.5 font-mono text-xs text-ink focus:border-focus focus:outline-none focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-line">
            <span className="text-2xs text-muted">
              {editingWidget.rows.length} rows cached in visual dataset
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingWidget(null)}
                className="h-8 rounded border border-line bg-white px-3 text-xs font-medium text-ink hover:bg-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 h-8 rounded bg-focus hover:bg-[#0c5a9e] disabled:opacity-40 px-3.5 text-xs font-semibold text-white transition"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 fill-current" />
                )}
                Save & Update Visual
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
