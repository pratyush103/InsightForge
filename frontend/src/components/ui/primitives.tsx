import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Join class names, skipping falsy values. */
export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ */
/* Brand mark: an "I" stem and an "F" for InsightForge, in gold.       */
/* ------------------------------------------------------------------ */
export const BrandMark: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
    <rect x="3" y="3" width="3" height="14" fill="var(--brand)" />
    <rect x="8" y="3" width="9" height="3" fill="var(--brand)" />
    <rect x="8" y="8.5" width="6" height="3" fill="var(--brand)" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'subtle';
  size?: 'sm' | 'md';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, children, ...rest }, ref) => (
    <button
      ref={ref}
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded font-semibold whitespace-nowrap',
        'transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-sm' : 'h-8 px-3.5 text-sm',
        variant === 'primary' && 'bg-ink text-white hover:bg-[#3b3a39] active:bg-black',
        variant === 'secondary' && 'border border-line-strong bg-page text-ink hover:bg-hover active:bg-pressed',
        variant === 'subtle' && 'text-ink hover:bg-hover active:bg-pressed',
        className
      )}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';

export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'light' | 'dark' }
> = ({ label, tone = 'light', className, children, ...rest }) => (
  <button
    {...rest}
    aria-label={label}
    title={label}
    className={cx(
      'inline-flex h-7 w-7 items-center justify-center rounded transition-colors duration-100',
      tone === 'light' ? 'text-muted hover:bg-hover hover:text-ink' : 'text-chrome-muted hover:bg-chrome-hover hover:text-chrome-ink',
      className
    )}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ */
/* Ribbon                                                              */
/* ------------------------------------------------------------------ */
export const RibbonGroup: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className,
}) => (
  <div role="group" aria-label={label} className={cx('flex h-full flex-col border-r border-line px-2 last:border-r-0', className)}>
    <div className="flex flex-1 items-start gap-0.5 pt-1.5">{children}</div>
    <div className="pb-1 text-center text-2xs text-muted">{label}</div>
  </div>
);

export const RibbonButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactNode; label: string; active?: boolean }
> = ({ icon, label, active, className, ...rest }) => (
  <button
    {...rest}
    aria-pressed={active}
    className={cx(
      'flex h-[52px] min-w-[52px] flex-col items-center justify-start gap-1 rounded px-1.5 pt-1.5 text-xs text-ink',
      'transition-colors duration-100 hover:bg-hover active:bg-pressed disabled:opacity-40 disabled:hover:bg-transparent',
      active && 'bg-pressed',
      className
    )}
  >
    <span className="flex h-5 items-center text-ink [&>svg]:h-5 [&>svg]:w-5 [&>svg]:stroke-[1.5]">{icon}</span>
    <span className="leading-tight">{label}</span>
  </button>
);

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */
export const Field: React.FC<{ label: string; htmlFor: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  label,
  htmlFor,
  hint,
  children,
  className,
}) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-ink">
      {label}
    </label>
    {children}
    {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
  </div>
);

export const inputClass =
  'h-8 w-full rounded border border-line-strong bg-page px-2 text-sm text-ink placeholder:text-subtle ' +
  'hover:border-muted focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus';

/* ------------------------------------------------------------------ */
/* Dialog: centred, square, with focus moved in and Escape to close.   */
/* ------------------------------------------------------------------ */
export const Dialog: React.FC<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ open, title, description, onClose, width = 'max-w-2xl', children, footer }) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('flex max-h-[88vh] w-full flex-col rounded-md bg-page shadow-dialog focus:outline-none', width)}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
          <div>
            <h2 id="dialog-title" className="text-xl font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 max-w-[62ch] text-sm text-muted">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Inline status message                                               */
/* ------------------------------------------------------------------ */
export const MessageBar: React.FC<{ tone: 'error' | 'success' | 'warning' | 'info'; children: React.ReactNode; action?: React.ReactNode }> = ({
  tone,
  children,
  action,
}) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={cx(
      'flex items-start justify-between gap-3 border-l-[3px] px-3 py-2 text-sm',
      tone === 'error' && 'border-bad bg-[#fdf3f4] text-ink',
      tone === 'success' && 'border-good bg-[#f1faf1] text-ink',
      tone === 'warning' && 'border-[#c19c00] bg-[#fff9e6] text-ink',
      tone === 'info' && 'border-focus bg-focus-tint text-ink'
    )}
  >
    <div className="min-w-0">{children}</div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/** Small uppercase-free section caption used in panes. */
export const PaneHeading: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
  <div className="flex items-center justify-between px-3 pb-1 pt-3">
    <h3 className="text-sm font-semibold text-ink">{children}</h3>
    {action}
  </div>
);

/** Dialect label used everywhere a source is named. */
export const dialectLabel = (d: string) =>
  d === 'mssql' ? 'SQL Server' : d === 'mysql' ? 'MySQL' : d === 'sqlite' ? 'SQLite' : d.toUpperCase();
