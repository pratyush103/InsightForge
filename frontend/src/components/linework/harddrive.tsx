"use client";

import "@/lib/linework/figures/harddrive-figure";

import { LineworkFigure, type LineworkFigureProps } from "@/components/linework/linework-figure";

/** Hard Drive: An open hard drive: the arm seeks the track at the pointer's distance from the spindle, on a spring. */
export function HardDrive(props: LineworkFigureProps) {
  return <LineworkFigure name="harddrive" label="Hard Drive" {...props} />;
}
