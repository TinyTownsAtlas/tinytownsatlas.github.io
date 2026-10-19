import type { AtlasData, Indicator } from "./data";
import type { ExpressionSpecification } from "maplibre-gl";

/**
 * Single source of truth for map colour layers. The map's paint expression and the legend are
 * both derived from the same MapLayer object, so they cannot diverge.
 */

export const REMOTENESS_LAYER_KEY = "remoteness_name";
export const ALL_TOWNS_KEY = "all_towns";
export const NEUTRAL_COLOR = "#687d89";
export const HOSPITAL_COLORS = ["#466b9a", "#f1eee8", "#aa6539"] as const;
export const HOSPITAL_KEYS = ["public_admissions", "pph"] as const;
export const POPULATION_RADIUS_FACTOR = 0.2;
export const POPULATION_LEGEND_VALUES = [100, 500, 1000, 1499];
export function populationRadius(population: number): number {
  return POPULATION_RADIUS_FACTOR * Math.sqrt(population);
}
/** Area proportional to population: radius 2–7.75px across the primary universe. */
export function populationRadiusExpression(): ExpressionSpecification {
  return ["*", POPULATION_RADIUS_FACTOR, ["sqrt", ["number", ["get", "population"], 100]]];
}

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

export interface NeutralLayer {
  kind: "neutral";
  key: string;
  optionLabel: string;
  title: string;
}

export interface HospitalLayer {
  kind: "hospital";
  key: string;
  optionLabel: string;
  title: string;
  // Symmetric log-ratio scale: 50 and 200 are equally far from Australia = 100.
  domain: [50, 100, 200];
  colors: typeof HOSPITAL_COLORS;
}

export type MapLayer = NeutralLayer | CategoricalLayer | SequentialLayer | HospitalLayer;

/** All towns, metadata-driven Census conditions, hospital SR layers, then optional geography. */
export function getMapLayers(data: AtlasData): MapLayer[] {
  const counts = new Map<string, number>();
  for (const t of data.towns) counts.set(t.remoteness_name, (counts.get(t.remoteness_name) ?? 0) + 1);

  const remoteness: CategoricalLayer = {
    kind: "categorical",
    key: REMOTENESS_LAYER_KEY,
    optionLabel: "Remoteness (ABS)",
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
      optionLabel: indicator.shortLabel,
      title: `${indicator.shortLabel}, % of ${indicator.denominatorLabel}`,
      domain: indicator.domain,
      colors: SEQUENTIAL_RAMP,
      indicator,
    }));

  const hospital: HospitalLayer[] = HOSPITAL_KEYS.map((key) => ({
    kind: "hospital", key,
    optionLabel: key === "public_admissions" ? "Hospital admissions" : "Preventable hospitalisations",
    title: data.hospital?.indicators[key] ? `${data.hospital.indicators[key].label} · ${data.hospital.indicators[key].period}` : key,
    domain: [50, 100, 200], colors: HOSPITAL_COLORS,
  }));
  return [{kind: "neutral", key: ALL_TOWNS_KEY, optionLabel: "All towns", title: "All towns"}, ...health, ...hospital, remoteness];
}

/** Unknown, missing and context-only layer keys fall back to All towns. */
export function resolveLayer(layers: MapLayer[], key: string | null | undefined): MapLayer {
  return layers.find((l) => l.key === key) ?? layers[0];
}

export type ColorExpression = unknown[];

/** MapLibre `circle-color` expression for a layer. */
export function colorExpression(layer: MapLayer): ColorExpression {
  if (layer.kind === "neutral") return ["literal", NEUTRAL_COLOR];
  if (layer.kind === "hospital") {
    return ["case", ["==", ["typeof", ["get", layer.key]], "number"],
      ["interpolate", ["linear"], ["ln", ["max", 0.000001, ["number", ["get", layer.key], 100]]],
        ...layer.domain.flatMap((value, i) => [Math.log(value), layer.colors[i]])], FALLBACK_COLOR];
  }
  if (layer.kind === "categorical") {
    const stops = layer.categories.flatMap((c) => [c.value, c.color]);
    return ["match", ["get", layer.key], ...stops, FALLBACK_COLOR];
  }
  const [lo, hi] = layer.domain;
  return ["interpolate", ["linear"], ["get", layer.key], lo, layer.colors[0], Math.max(hi, lo + 1e-9), layer.colors[1]];
}

/** Missing/suppressed ratios stay null, never zero; allocated counts are never read. */
export function hospitalMapValues(data: AtlasData, code: string): Record<string, number | null> {
  return Object.fromEntries(HOSPITAL_KEYS.map((key) => {
    const v = data.hospital.towns[code]?.values[key];
    return [key, v?.status === "available" && v.sr !== null && Number.isFinite(v.sr) && v.sr > 0 ? v.sr : null];
  }));
}

/** Same supplied PHA and published selected measure, never a group inferred from rounded values. */
export function sharedHospitalTowns(data: AtlasData, code: string | null, key: string): string[] {
  const selected = code ? data.hospital.towns[code] : undefined;
  if (!selected?.phaCode || selected.values[key]?.status !== "available") return [];
  return data.towns.filter((t) => {
    const entry = data.hospital.towns[t.ucl_code];
    return t.ucl_code !== code && entry?.phaCode === selected.phaCode && entry.values[key]?.status === "available";
  }).map((t) => t.ucl_code);
}
