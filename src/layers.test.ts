import { describe, expect, it } from "vitest";
import type { AtlasData, Indicator, IndicatorStats, Town } from "./data";
import {
  REMOTENESS_LAYER_KEY,
  REMOTENESS_PALETTE,
  colorExpression,
  getMapLayers,
  resolveLayer,
  type CategoricalLayer,
  type SequentialLayer,
} from "./layers";

const RA = [
  "Major Cities of Australia",
  "Inner Regional Australia",
  "Outer Regional Australia",
  "Remote Australia",
  "Very Remote Australia",
];

const stats: IndicatorStats = { median: 1, q1: 0, q3: 2, p10: 0, p90: 3, n: 2 };

function indicator(key: string, category: "health" | "context", mapLayer: boolean): Indicator {
  return {
    key,
    label: key,
    shortLabel: key,
    unit: "percent",
    precision: 1,
    numeratorField: key.replace("_pct", "_count"),
    denominatorField: key.replace("_pct", "_denominator"),
    denominatorLabel: "usual residents",
    category,
    isDefaultMapLayer: false,
    mapLayer,
    isRankable: false,
    colorScale: "sequential",
    domain: [0, 10],
    description: "",
    definition: "",
    caveats: ["c"],
    source: "s",
    nationalStats: stats,
    remotenessStats: {},
  };
}

function town(code: string, remoteness: string): Town {
  return {
    ucl_code: code,
    ucl_name: code,
    state_code: 1,
    state_name: "New South Wales",
    remoteness_code: RA.indexOf(remoteness) + 1,
    remoteness_name: remoteness,
    population: 500,
    scope: "primary",
    lon: 0,
    lat: 0,
  };
}

const data = {
  towns: [town("A", "Remote Australia"), town("B", "Remote Australia"), town("C", "Very Remote Australia")],
  indicators: {
    diabetes_pct: indicator("diabetes_pct", "health", true),
    cancer_pct: indicator("cancer_pct", "health", true),
    indigenous_pct: indicator("indigenous_pct", "context", false),
    degree_pct: indicator("degree_pct", "context", false),
  },
  manifest: { remotenessOrder: RA },
} as unknown as AtlasData;

describe("map layers", () => {
  const layers = getMapLayers(data);

  it("puts remoteness first, then opt-in health layers only", () => {
    expect(layers.map((l) => l.key)).toEqual([REMOTENESS_LAYER_KEY, "diabetes_pct", "cancer_pct"]);
  });

  it("never offers context indicators (e.g. Aboriginal and Torres Strait Islander share) as layers", () => {
    expect(layers.some((l) => l.key === "indigenous_pct")).toBe(false);
    expect(resolveLayer(layers, "indigenous_pct").key).toBe(REMOTENESS_LAYER_KEY);
  });

  it("falls back to remoteness for unknown or missing keys", () => {
    expect(resolveLayer(layers, "nonsense").key).toBe(REMOTENESS_LAYER_KEY);
    expect(resolveLayer(layers, null).key).toBe(REMOTENESS_LAYER_KEY);
    expect(resolveLayer(layers, "cancer_pct").key).toBe("cancer_pct");
  });

  it("lists Remoteness Areas in official order with the shared palette and town counts", () => {
    const remoteness = layers[0] as CategoricalLayer;
    expect(remoteness.categories.map((c) => c.value)).toEqual(RA);
    expect(remoteness.categories.map((c) => c.color)).toEqual(RA.map((n) => REMOTENESS_PALETTE[n]));
    expect(remoteness.categories.find((c) => c.value === "Remote Australia")?.count).toBe(2);
    expect(remoteness.categories.find((c) => c.value === "Major Cities of Australia")?.count).toBe(0);
  });

  it("paints the map with exactly the colours the legend shows", () => {
    const remoteness = layers[0] as CategoricalLayer;
    const expr = colorExpression(remoteness);
    expect(expr.slice(0, 2)).toEqual(["match", ["get", REMOTENESS_LAYER_KEY]]);
    const pairs = expr.slice(2, -1);
    expect(pairs).toEqual(remoteness.categories.flatMap((c) => [c.value, c.color]));

    const cancer = layers[2] as SequentialLayer;
    expect(colorExpression(cancer)).toEqual([
      "interpolate",
      ["linear"],
      ["get", "cancer_pct"],
      cancer.domain[0],
      cancer.colors[0],
      cancer.domain[1],
      cancer.colors[1],
    ]);
  });
});

describe("palette has one definition", () => {
  it("no other source file hard-codes the remoteness colours", () => {
    const sources = import.meta.glob<string>(["./*.ts", "!./*.test.ts", "!./layers.ts"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThan(5);
    const offenders = Object.entries(sources)
      .filter(([, src]) => Object.values(REMOTENESS_PALETTE).some((hex) => src.toLowerCase().includes(hex.toLowerCase())))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
