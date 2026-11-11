/**
 * Single source for colour and type outside CSS. Tailwind reads the CSS variables in index.css;
 * ECharts can't, so the same values live here.
 */
export const brand = {
  accent: '#F2C811',
  focus: '#0F6CBD',
  ink: '#252423',
  muted: '#605E5C',
  subtle: '#8A8886',
  line: '#E1DFDD',
  lineStrong: '#C8C6C4',
  gridline: '#EDEBE9',
  page: '#FFFFFF',
  good: '#107C10',
  bad: '#C50F1F',
  fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
  monoFamily: '"Cascadia Mono", Consolas, ui-monospace, monospace',
} as const;

/** Data colours: report-style, flat, ordered so neighbours never look alike. */
export const dataPalette = [
  '#118DFF',
  '#12239E',
  '#E66C37',
  '#D9B300',
  '#1AAB40',
  '#D64550',
  '#197278',
  '#6B6B6B',
] as const;

/** Sequential scale for heatmaps and maps. */
export const sequentialBlue = ['#EAF4FF', '#7FBFFF', '#1A7FE0'] as const;
