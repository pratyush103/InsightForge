/** @type {import('tailwindcss').Config} */
// Report-tool tokens. Values live as CSS variables in src/index.css; mirrored in src/lib/brand.ts for ECharts.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        chrome: 'var(--chrome)',
        'chrome-ink': 'var(--chrome-ink)',
        'chrome-muted': 'var(--chrome-muted)',
        'chrome-hover': 'var(--chrome-hover)',
        canvas: 'var(--canvas)',
        page: 'var(--page)',
        pane: 'var(--pane)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        subtle: 'var(--subtle)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        hover: 'var(--hover)',
        pressed: 'var(--pressed)',
        brand: 'var(--brand)',
        focus: 'var(--focus)',
        'focus-tint': 'var(--focus-tint)',
        good: 'var(--good)',
        bad: 'var(--bad)',
        warn: 'var(--warn)',
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Segoe UI Web (West European)"', '-apple-system', 'BlinkMacSystemFont', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"Cascadia Mono"', 'Consolas', 'ui-monospace', '"SF Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs: ['11px', '16px'],
        sm: ['12px', '16px'],
        base: ['14px', '20px'],
        lg: ['16px', '22px'],
        xl: ['20px', '28px'],
        '2xl': ['28px', '34px'],
        '3xl': ['40px', '44px'],
      },
      borderRadius: {
        DEFAULT: '2px',
        sm: '2px',
        md: '4px',
      },
      boxShadow: {
        page: '0 1.6px 3.6px rgba(0,0,0,0.13), 0 0.3px 0.9px rgba(0,0,0,0.11)',
        flyout: '0 6.4px 14.4px rgba(0,0,0,0.13), 0 1.2px 3.6px rgba(0,0,0,0.11)',
        dialog: '0 25.6px 57.6px rgba(0,0,0,0.22), 0 4.8px 14.4px rgba(0,0,0,0.18)',
      },
    },
  },
  plugins: [],
};
