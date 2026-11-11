import React from 'react';
import { ArrowDownRight, ArrowUpRight, Code2, Minus } from 'lucide-react';
import type { DashboardWidgetSpec } from '../../types/insightforge';
import { useDashboardStore } from '../../store/useDashboardStore';
import { brand } from '../../lib/brand';

interface Props {
  widget: DashboardWidgetSpec;
}

export const KpiCardWidget: React.FC<Props> = ({ widget }) => {
  const { setEditingWidget, selectedWidgetId, selectWidget } = useDashboardStore();
  const kpi = widget.kpi_payload;

  const sparkPoints = kpi?.sparkline || [];
  let svgPath = '';

  if (sparkPoints.length >= 2) {
    const minV = Math.min(...sparkPoints);
    const maxV = Math.max(...sparkPoints);
    const range = maxV - minV || 1;
    const width = 110;
    const height = 30;
    const coords = sparkPoints.map((v, idx) => {
      const x = (idx / (sparkPoints.length - 1)) * width;
      const y = height - ((v - minV) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    svgPath = `M ${coords.join(' L ')}`;
  }

  const isUp = kpi?.delta_direction === 'up';
  const isDown = kpi?.delta_direction === 'down';
  const strokeColor = isDown ? brand.bad : brand.good;
  const isSelected = selectedWidgetId === widget.id;

  return (
    <div
      onClick={() => selectWidget(widget.id)}
      className={`h-full w-full flex flex-col justify-between p-3 select-none bg-white rounded transition-shadow ${
        isSelected ? 'ring-2 ring-focus' : ''
      }`}
    >
      {/* Visual Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="drag-handle cursor-grab active:cursor-grabbing text-xs font-semibold text-ink truncate">
            {widget.title}
          </div>
          <div className="text-2xs text-muted truncate">
            {widget.subtitle || kpi?.metric_label}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingWidget(widget);
          }}
          title="Inspect SQL"
          className="rounded p-1 text-muted hover:bg-hover hover:text-ink transition"
        >
          <Code2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main Callout Number & Sparkline */}
      <div className="flex items-end justify-between gap-2 my-1">
        <div className="font-sans text-2xl font-bold tracking-tight text-ink tnum">
          {kpi?.formatted_value ?? '—'}
        </div>

        {sparkPoints.length >= 2 && (
          <svg width="100" height="28" viewBox="0 0 110 30" className="shrink-0 overflow-visible">
            <path d={svgPath} fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Metric Delta & Subtext */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-line text-xs">
        {kpi && kpi.delta_pct !== 0 ? (
          <span
            className={`inline-flex items-center gap-0.5 font-medium tnum ${
              isUp ? 'text-good' : isDown ? 'text-bad' : 'text-muted'
            }`}
          >
            {isUp ? (
              <ArrowUpRight className="h-3.5 w-3.5 stroke-[2]" />
            ) : isDown ? (
              <ArrowDownRight className="h-3.5 w-3.5 stroke-[2]" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {kpi.delta_pct > 0 ? `+${kpi.delta_pct}%` : `${kpi.delta_pct}%`}
          </span>
        ) : (
          <span className="text-2xs text-muted">Baseline</span>
        )}

        <span className="text-2xs text-subtle truncate max-w-[130px]">{kpi?.subtext}</span>
      </div>
    </div>
  );
};
