// Linework: the engine every figure runs on. Figures are written against two globals,
// `HL` (the kernel) and `hairline(...)` (register a figure), which this module sets up.
import kernel from "./kernel.js";

type Point = [number, number];

type Handle = { set: (value: number) => void; destroy: () => void };

export type Figure = {
  name: string;
  means: string;
  rules: number[];
  range: [number, number, number];
  tour: (Point | null)[] | null;
  mount: (
    host: { stage: HTMLElement; svg: SVGSVGElement; read: { textContent: string | null } },
    value: number,
  ) => Handle;
};

type Kernel = {
  inject: (root: Document) => void;
  mk: (tag: string, attrs: Record<string, string>, parent: Element) => SVGSVGElement;
  tour: (stage: HTMLElement, stops: (Point | null)[]) => { stop: () => void };
  LAP: (Point | null)[];
};

declare global {
  var HL: unknown;
  var hairline: (figure: Figure) => void;
}

const HL = kernel as Kernel;
const registry = new Map<string, Figure>();

globalThis.HL = kernel;
globalThis.hairline = (figure) => {
  registry.set(figure.name, figure);
};

export type MountOptions = {
  /** Where the figure's read-out text goes; omit to hide it. */
  readout?: HTMLElement | null;
  /** Play the figure's tour: an unseen pointer that walks it until a real one arrives. Default true. */
  tour?: boolean;
  /** The slider value, from the figure's own range; default is the middle of it. */
  value?: number;
};

/** Mounts a registered figure into `stage` and returns the function that removes it. */
export function mountFigure(stage: HTMLElement, name: string, options: MountOptions = {}) {
  const figure = registry.get(name);
  if (!figure) throw new Error(`Linework figure "${name}" is not registered. Import its file first.`);
  HL.inject(document);
  const svg = HL.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, stage);
  let text = "";
  const read = {
    get textContent() {
      return text;
    },
    set textContent(value: string | null) {
      text = value ?? "";
      if (options.readout) options.readout.textContent = text;
    },
  };

  const handle = figure.mount({ stage, svg, read }, options.value ?? figure.range[1]);
  if (!text) read.textContent = "rest";
  const playing = options.tour === false ? null : HL.tour(stage, figure.tour ?? HL.LAP);

  return () => {
    playing?.stop();
    handle.destroy();
    svg.remove();
    if (options.readout) options.readout.textContent = "";
  };
}
