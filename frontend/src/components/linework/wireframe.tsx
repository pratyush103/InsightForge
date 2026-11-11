"use client";

import "@/lib/linework/figures/wireframe-figure";

import { LineworkFigure, type LineworkFigureProps } from "@/components/linework/linework-figure";

/** Wireframe: A page's layout as tiles on a grid: the parts near the pointer lift off their slots, the farther the less. */
export function Wireframe(props: LineworkFigureProps) {
  return <LineworkFigure name="wireframe" label="Wireframe" {...props} />;
}
