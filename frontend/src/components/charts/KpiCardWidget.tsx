import React from 'react';
import { ArrowDownRight, ArrowUpRight, Code2, Minus, Sparkles } from 'lucide-react';
import type { DashboardWidgetSpec } from '../../types/insightforge';
import { useDashboardStore } from '../../store/useDashboardStore';

interface Props {
  widget: DashboardWidgetSpec;
}

export const KpiCardWidget: React.FC<Props> = ({ widget }) => {
  const { setEditingWidget } = useDashboardStore();
  const kpi = widget.kpi_payload;

  const sparkPoints = kpi?.sparkline || [];
  let svgPath = '';
  let areaPath = '';

  if (sparkPoints.length >= 2) {
    const minV = Math.min(...sparkPoints);
    const maxV = Math.max(...sparkPoints);
    const range = maxV - minV || 1;
    const width = 140;
    const height = 38;
    const coords = sparkPoints.map((v, idx) => {
      const x = (idx / (sparkPoints.length - 1)) * width;
      const y = height - ((v - minV) / range) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    svgPath = `M ${coords.join(' L ')}`;
    areaPath = `${svgPath} L ${width},${height} L 0,${height} Z`;
  }

  const isUp = kpi?.delta_direction === 'up';
  const isDown = kpi?.delta_direction === 'down';
  const strokeColor = isDown ? '#f43f5e' : '#10b981';

  return (
    <div className="h-full w-full flex flex-col justify-between p-4 select-none relative group">
      {/* Top Row: Title + Inspect SQL button */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="drag-handle cursor-grab active:cursor-grabbing text-xs font-semibold text-slate-300 truncate group-hover:text-indigo-300 transition">
            {widget.title}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{widget.subtitle || kpi?.metric_label}</div>
        </div>

        <button
          onClick={() => setEditingWidget(widget)}
          title="Inspect SQL & Mutate Widget"
          className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-indigo-300 transition"
        >
          <Code2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Middle Row: Big Tabular Metric + Sparkline */}
      <div className="flex items-end justify-between gap-3 my-1">
        <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
          {kpi?.formatted_value ?? '—'}
        </div>

        {sparkPoints.length >= 2 && (
          <svg width="115" height="36" viewBox="0 0 140 38" className="shrink-0 overflow-visible">
            <defs>
              <linearGradient id={`grad_${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#grad_${widget.id})`} />
            <path d={svgPath} fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Bottom Row: Delta Badge & Subtext */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
        {kpi && kpi.delta_pct !== 0 ? (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-mono font-semibold ${
              isUp
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : isDown
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isUp ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : isDown ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {kpi.delta_pct > 0 ? `+${kpi.delta_pct}%` : `${kpi.delta_pct}%`}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-indigo-400">
            <Sparkles className="h-3 w-3" /> Verified SQL
          </span>
        )}

        <span className="text-[11px] text-slate-400 truncate">{kpi?.subtext}</span>
      </div>
    </div>
  );
};
