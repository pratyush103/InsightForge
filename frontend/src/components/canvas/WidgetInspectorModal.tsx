import React, { useEffect, useState } from 'react';
import { CheckCircle2, Code2, Loader2, Play, ShieldCheck, X } from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { ChartArchetype } from '../../types/insightforge';

const ALL_CHART_TYPES: { id: ChartArchetype; label: string }[] = [
  { id: 'geo_map', label: 'Geographic World Map (Choropleth + Ripple Hubs)' },
  { id: 'kpi', label: 'Executive KPI Card' },
  { id: 'area_spline', label: 'Area Spline (Gradient + Moving Avg)' },
  { id: 'multi_line', label: 'Multi-Series Line' },
  { id: 'grouped_bar', label: 'Grouped Column Bar' },
  { id: 'stacked_bar', label: 'Stacked Column Bar' },
  { id: 'horizontal_bar', label: 'Horizontal Ranking Bar' },
  { id: 'combo_dual_axis', label: 'Dual-Axis Combo (Bar + Line)' },
  { id: 'donut', label: 'Donut Share Chart' },
  { id: 'rose', label: 'Nightingale Rose Chart' },
  { id: 'funnel', label: 'Conversion Funnel' },
  { id: 'heatmap', label: '2D Matrix Heatmap' },
  { id: 'sankey', label: 'Sankey Attribution Flow' },
  { id: 'radar', label: 'Multi-Axis Radar' },
  { id: 'treemap', label: 'Hierarchical Treemap' },
  { id: 'scatter', label: 'Bivariate Scatter Plot' },
  { id: 'table', label: 'Interactive Data Table' },
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Code2 className="h-5 w-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Widget SQL Lineage & Visual Configuration
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Step: {editingWidget.step_id} • Hash: {editingWidget.data_hash}
              </p>
            </div>
          </div>

          <button
            onClick={() => setEditingWidget(null)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 font-mono">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Widget Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Visualization Archetype
              </label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartArchetype)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
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
              <label className="text-xs font-medium text-slate-400">
                Underlying Read-Only SQL Query
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> SQLGlot AST Verified
              </span>
            </div>
            <textarea
              rows={5}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-300 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
              {editingWidget.rows.length} rows cached in widget dataset
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingWidget(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                Execute & Update Widget
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
