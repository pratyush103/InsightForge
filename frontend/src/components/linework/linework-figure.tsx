"use client";

import { useEffect, useRef } from "react";

import { mountFigure } from "@/lib/linework";

export type LineworkFigureProps = {
  /** Accessible name for the drawing. */
  label?: string;
  /** Show the small read-out in the top-right corner. Default true. */
  readout?: boolean;
  /** Play the figure's tour until a real pointer arrives. Default true. */
  tour?: boolean;
  className?: string;
};

/** Draws one Linework figure. Its file must be imported first; each figure's own component does that. */
export function LineworkFigure({
  name,
  label,
  readout = true,
  tour = true,
  className = "",
}: LineworkFigureProps & { name: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!stageRef.current) return;
    return mountFigure(stageRef.current, name, { readout: readoutRef.current, tour });
  }, [name, tour]);

  return (
    <div className={`relative ${className}`}>
      {readout && (
        <span
          ref={readoutRef}
          className="pointer-events-none absolute top-3 right-4 z-10 font-mono text-[11px] tabular-nums opacity-80"
        />
      )}
      <div ref={stageRef} data-hairline={name} role="img" aria-label={label ?? `${name} illustration`} />
    </div>
  );
}
