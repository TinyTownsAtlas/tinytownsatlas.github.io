import type { AtlasData, Indicator } from "./data";

/**
 * Single source of truth for map colour layers. The map's paint expression and the legend are
 * both derived from the same MapLayer object, so they cannot diverge.
 */

export const REMOTENESS_LAYER_KEY = "remoteness_name";

/** ABS 2021 Remoteness Area colours, keyed by the official RA name. */
export const REMOTENESS_PALETTE: Record<string, string> = {
  "Major Cities of Australia": "#4c78a8",
  "Inner Regional Australia": "#72b7b2",
  "Outer Regional Australia": "#eeca3b",
  "Remote Australia": "#f58518",
  "Very Remote Australia": "#e45756",
};

/** Sequential ramp for Census health outcome layers (light = lower share, dark = higher). */
export const SEQUENTIAL_RAMP: [string, string] = ["#fff5eb", "#a63603"];

export const FALLBACK_COLOR = "#999999";

export interface CategoricalLayer {
  kind: "categorical";
  key: string;
  /** Option text in the layer selector. */
  optionLabel: string;
  /** Legend heading. */
  title: string;
  categories: Array<{ value: string; label: string; color: string; count: number }>;
}

export interface SequentialLayer {
  kind: "sequential";
  key: string;
  optionLabel: string;
  title: string;
  domain: [number, number];
  colors: [string, string];
  indicator: Indicator;
}

export type MapLayer = CategoricalLayer | SequentialLayer;

/** Remoteness (neutral default) followed by every opt-in health indicator flagged as a map layer. */
export function getMapLayers(data: AtlasData): MapLayer[] {
  const counts = new Map<string, number>();
  for (const t of data.towns) counts.set(t.remoteness_name, (counts.get(t.remoteness_name) ?? 0) + 1);

  const remoteness: CategoricalLayer = {
    kind: "categorical",
    key: REMOTENESS_LAYER_KEY,
    optionLabel: "Remoteness Area (default)",
    title: "Remoteness Area (ABS 2021)",
    categories: data.manifest.remotenessOrder.map((name) => ({
      value: name,
      label: name,
      color: REMOTENESS_PALETTE[name] ?? FALLBACK_COLOR,
      count: counts.get(name) ?? 0,
    })),
  };

  const health: SequentialLayer[] = Object.values(data.indicators)
    .filter((i) => i.category === "health" && i.mapLayer)
    .map((indicator) => ({
      kind: "sequential",
      key: indicator.key,
      optionLabel: indicator.label,
      title: `${indicator.label}, % of ${indicator.denominatorLabel}`,
      domain: indicator.domain,
      colors: SEQUENTIAL_RAMP,
      indicator,
    }));

  return [remoteness, ...health];
}

/** Resolve a layer key (e.g. from the URL) to a layer; unknown or non-map keys fall back to remoteness. */
export function resolveLayer(layers: MapLayer[], key: string | null | undefined): MapLayer {
  return layers.find((l) => l.key === key) ?? layers[0];
}

export type ColorExpression = unknown[];

/** MapLibre `circle-color` expression for a layer. */
export function colorExpression(layer: MapLayer): ColorExpression {
  if (layer.kind === "categorical") {
    const stops = layer.categories.flatMap((c) => [c.value, c.color]);
    return ["match", ["get", layer.key], ...stops, FALLBACK_COLOR];
  }
  const [lo, hi] = layer.domain;
  return ["interpolate", ["linear"], ["get", layer.key], lo, layer.colors[0], Math.max(hi, lo + 1e-9), layer.colors[1]];
}
