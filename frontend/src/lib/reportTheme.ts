import { brand, dataPalette, sequentialBlue } from './brand';

/**
 * The backend compiles ECharts options for a dark, glowing theme (and saved pipelines keep those
 * options verbatim). This pass re-skins any option to the report theme at render time: flat data
 * colours, light gridlines, square bars, no gradients, glows or ripples.
 */

type Json = unknown;
type Obj = Record<string, unknown>;

const LEGACY_PALETTE: Record<string, string> = {
  '#6366f1': dataPalette[0],
  '#4f46e5': dataPalette[0],
  '#06b6d4': dataPalette[1],
  '#10b981': dataPalette[2],
  '#f59e0b': dataPalette[3],
  '#ec4899': dataPalette[5],
  '#8b5cf6': dataPalette[6],
  '#3b82f6': dataPalette[4],
  '#14b8a6': dataPalette[7],
};

const LEGACY_TEXT = new Set(['#94a3b8', '#cbd5e1', '#e2e8f0', '#f8fafc', '#f1f5f9', '#64748b']);
const LEGACY_SEGMENT_BORDER = new Set(['#0f172a', '#020617', '#1e293b']);

const isObj = (v: Json): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function mapColor(value: string, role: 'data' | 'text' | 'border' = 'data'): string {
  const v = value.trim().toLowerCase();
  if (v.startsWith('#') && v.length === 9) {
    // "#rrggbbaa": keep alpha, remap the hue
    const base = mapColor(v.slice(0, 7), role);
    return base + v.slice(7);
  }
  if (LEGACY_PALETTE[v]) return LEGACY_PALETTE[v];
  if (LEGACY_TEXT.has(v)) return role === 'text' ? brand.muted : brand.ink;
  if (LEGACY_SEGMENT_BORDER.has(v)) return brand.page;
  if (v.startsWith('rgba(148,163,184') || v.startsWith('rgba(148, 163, 184')) return brand.gridline;
  if (v.startsWith('rgba(15, 23, 42') || v.startsWith('rgba(15,23,42') || v.startsWith('rgba(30,41,59')) {
    return brand.page;
  }
  if (v.startsWith('rgba(99, 102, 241') || v.startsWith('rgba(16, 185, 129')) return brand.lineStrong;
  return value;
}

function flattenGradient(g: Obj): string {
  const stops = Array.isArray(g.colorStops) ? (g.colorStops as Obj[]) : [];
  const first = stops[0]?.color;
  return typeof first === 'string' ? mapColor(first.slice(0, 7)) : dataPalette[0];
}

function walk(node: Json, key: string, parentKey: string): Json {
  if (Array.isArray(node)) {
    // "color" palettes at any level
    if (key === 'color') return node.map((c) => (typeof c === 'string' ? mapColor(c) : c));
    return node.map((n) => walk(n, key, parentKey));
  }
  if (typeof node === 'string') {
    if (key === 'color' || key === 'borderColor' || key === 'areaColor' || key === 'backgroundColor') {
      if (node === 'gradient') return 'source';
      const role = parentKey === 'textStyle' || parentKey === 'label' || parentKey === 'axisLabel' || parentKey === 'axisName' ? 'text' : key === 'borderColor' ? 'border' : 'data';
      return mapColor(node, role);
    }
    return node;
  }
  if (!isObj(node)) return node;

  // Gradient fills become flat colour
  if (node.type === 'linear' && Array.isArray(node.colorStops)) return flattenGradient(node);

  const out: Obj = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'shadowBlur' || k === 'shadowColor' || k === 'shadowOffsetX' || k === 'shadowOffsetY') continue;
    if (k === 'borderRadius') {
      out[k] = 0;
      continue;
    }
    out[k] = walk(v, k, key);
  }
  return out;
}

const axisDefaults = (axis: Obj): Obj => ({
  ...axis,
  axisLabel: { ...(axis.axisLabel as Obj), color: brand.muted, fontSize: 11 },
  axisLine: { ...(axis.axisLine as Obj), lineStyle: { color: brand.lineStrong } },
  axisTick: { show: false },
  splitLine:
    (axis.splitLine as Obj)?.show === false
      ? axis.splitLine
      : { ...(axis.splitLine as Obj), lineStyle: { color: brand.gridline, type: 'solid' } },
  nameTextStyle: { color: brand.muted, fontSize: 11 },
});

export function applyReportTheme(option: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!option) return {};
  const o = walk(option, '', '') as Obj;

  o.backgroundColor = 'transparent';
  o.textStyle = { fontFamily: brand.fontFamily, color: brand.ink };
  if (Array.isArray(o.color) || o.series) o.color = [...dataPalette];

  o.tooltip = {
    ...(o.tooltip as Obj),
    backgroundColor: brand.page,
    borderColor: brand.lineStrong,
    borderWidth: 1,
    padding: [6, 10],
    textStyle: { color: brand.ink, fontSize: 12, fontFamily: brand.fontFamily },
    extraCssText: 'border-radius:2px;box-shadow:0 3.2px 7.2px rgba(0,0,0,.13),0 .6px 1.8px rgba(0,0,0,.11);',
  };

  if (isObj(o.legend)) {
    o.legend = {
      ...o.legend,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      textStyle: { color: brand.muted, fontSize: 11, fontFamily: brand.fontFamily },
    };
  }

  for (const k of ['xAxis', 'yAxis'] as const) {
    const a = o[k];
    if (Array.isArray(a)) o[k] = a.map((x) => (isObj(x) ? axisDefaults(x) : x));
    else if (isObj(a)) o[k] = axisDefaults(a);
  }

  if (isObj(o.visualMap)) {
    o.visualMap = {
      ...o.visualMap,
      inRange: { color: [...sequentialBlue] },
      textStyle: { color: brand.muted, fontSize: 10 },
      itemWidth: 10,
      itemHeight: 90,
    };
  }

  if (isObj(o.radar)) {
    o.radar = {
      ...o.radar,
      splitArea: { show: false },
      splitLine: { lineStyle: { color: brand.line } },
      axisLine: { lineStyle: { color: brand.line } },
      axisName: { color: brand.muted, fontSize: 11 },
    };
  }

  if (isObj(o.geo)) {
    o.geo = {
      ...o.geo,
      itemStyle: { areaColor: '#F3F2F1', borderColor: brand.lineStrong, borderWidth: 0.6 },
      emphasis: { itemStyle: { areaColor: '#CFE6FF' }, label: { show: true, color: brand.ink, fontSize: 11 } },
    };
  }

  if (Array.isArray(o.dataZoom)) {
    o.dataZoom = (o.dataZoom as Obj[]).map((z) =>
      z.type === 'slider'
        ? {
            ...z,
            borderColor: brand.line,
            fillerColor: 'rgba(17,141,255,0.10)',
            backgroundColor: '#FAF9F8',
            handleStyle: { color: brand.page, borderColor: brand.subtle },
            moveHandleStyle: { color: brand.lineStrong },
            dataBackground: { lineStyle: { color: brand.lineStrong }, areaStyle: { color: brand.line } },
            textStyle: { color: brand.muted, fontSize: 10 },
          }
        : z
    );
  }

  if (Array.isArray(o.series)) {
    o.series = (o.series as Obj[]).map((s) => {
      const next: Obj = { ...s };
      switch (s.type) {
        case 'line': {
          next.smooth = false;
          next.symbol = s.symbol === 'none' ? 'none' : 'circle';
          next.symbolSize = s.symbol === 'none' ? 0 : 5;
          const ls = (s.lineStyle as Obj) || {};
          next.lineStyle = { ...ls, width: ls.type === 'dashed' ? 1.5 : 2 };
          if (s.areaStyle) {
            const c = (s.itemStyle as Obj)?.color ?? (ls.color as string) ?? dataPalette[0];
            next.areaStyle = { color: c, opacity: 0.1 };
          }
          if (ls.type === 'dashed') {
            next.lineStyle = { ...(next.lineStyle as Obj), color: brand.subtle };
            next.itemStyle = { color: brand.subtle };
          }
          break;
        }
        case 'bar':
          next.barMaxWidth = 28;
          next.barCategoryGap = '30%';
          break;
        case 'pie':
          next.itemStyle = { borderColor: brand.page, borderWidth: 1.5 };
          next.emphasis = { scale: true, scaleSize: 4, label: { show: true, fontSize: 13, fontWeight: 600, color: brand.ink } };
          break;
        case 'funnel':
          next.gap = 2;
          next.itemStyle = { borderColor: brand.page, borderWidth: 1 };
          break;
        case 'treemap':
          next.itemStyle = { borderColor: brand.page, borderWidth: 2, gapWidth: 2 };
          next.label = { ...(s.label as Obj), color: '#FFFFFF', fontSize: 11 };
          next.levels = undefined;
          break;
        case 'sankey':
          next.lineStyle = { color: 'source', curveness: 0.5, opacity: 0.25 };
          next.label = { color: brand.ink, fontSize: 11 };
          next.itemStyle = { borderWidth: 0 };
          break;
        case 'heatmap':
          next.label = { ...(s.label as Obj), color: brand.ink, fontSize: 10 };
          next.itemStyle = { borderColor: brand.page, borderWidth: 1 };
          break;
        case 'radar':
          next.symbolSize = 4;
          next.lineStyle = { width: 1.5 };
          break;
        case 'scatter':
          next.itemStyle = { ...(s.itemStyle as Obj), color: dataPalette[0], opacity: 0.75 };
          next.symbolSize = 9;
          break;
        case 'effectScatter':
          // No pulsing ripples on a report page: a plain marker with a quiet label.
          next.type = 'scatter';
          delete next.rippleEffect;
          delete next.showEffectOn;
          next.symbolSize = 10;
          next.itemStyle = { color: dataPalette[2], borderColor: brand.page, borderWidth: 1.5 };
          next.label = {
            show: true,
            position: 'top',
            formatter: '{b}',
            color: brand.ink,
            fontSize: 11,
            backgroundColor: brand.page,
            borderColor: brand.lineStrong,
            borderWidth: 1,
            borderRadius: 2,
            padding: [2, 5],
          };
          break;
        default:
          break;
      }
      return next;
    });
  }

  return o;
}
