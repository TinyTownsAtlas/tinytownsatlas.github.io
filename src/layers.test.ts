import { describe, expect, it } from "vitest";
import type { AtlasData, Indicator, IndicatorStats, Town } from "./data";
import {
  ALL_TOWNS_KEY, NEUTRAL_COLOR, hospitalMapValues, sharedHospitalTowns, populationRadius, populationRadiusExpression,
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

  it("puts All towns first, groups health and hospital layers before geography", () => {
    expect(layers.map((l) => l.key)).toEqual([ALL_TOWNS_KEY, "diabetes_pct", "cancer_pct", "public_admissions", "pph", REMOTENESS_LAYER_KEY]);
  });

  it("never offers context indicators (e.g. Aboriginal and Torres Strait Islander share) as layers", () => {
    expect(layers.some((l) => l.key === "indigenous_pct")).toBe(false);
    expect(resolveLayer(layers, "indigenous_pct").key).toBe(ALL_TOWNS_KEY);
  });

  it("falls back to All towns for unknown or missing keys", () => {
    expect(resolveLayer(layers, "nonsense").key).toBe(ALL_TOWNS_KEY);
    expect(resolveLayer(layers, null).key).toBe(ALL_TOWNS_KEY);
    expect(resolveLayer(layers, "cancer_pct").key).toBe("cancer_pct");
  });

  it("lists Remoteness Areas in official order with the shared palette and town counts", () => {
    const remoteness = layers.find((l) => l.key === REMOTENESS_LAYER_KEY) as CategoricalLayer;
    expect(remoteness.categories.map((c) => c.value)).toEqual(RA);
    expect(remoteness.categories.map((c) => c.color)).toEqual(RA.map((n) => REMOTENESS_PALETTE[n]));
    expect(remoteness.categories.find((c) => c.value === "Remote Australia")?.count).toBe(2);
    expect(remoteness.categories.find((c) => c.value === "Major Cities of Australia")?.count).toBe(0);
  });

  it("paints the map with exactly the colours the legend shows", () => {
    const remoteness = layers.find((l) => l.key === REMOTENESS_LAYER_KEY) as CategoricalLayer;
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


describe("neutral and hospital layers", () => {
  it("keeps marker area proportional to population with one shared scale across layers", () => {
    expect(populationRadius(100)).toBe(2);
    expect(populationRadius(1499)).toBeLessThan(8);
    expect(populationRadius(1000) ** 2 / populationRadius(100) ** 2).toBeCloseTo(10);
    expect(populationRadiusExpression()).toEqual(["*", 0.2, ["sqrt", ["number", ["get", "population"], 100]]]);
  });
  it("uses one restrained neutral colour independent of remoteness or health", () => {
    const neutral = getMapLayers(data)[0];
    expect(neutral.kind).toBe("neutral");
    expect(colorExpression(neutral)).toEqual(["literal", NEUTRAL_COLOR]);
    expect("categories" in neutral).toBe(false);
  });
  it("centres the diverging log-ratio scale on 100 and handles missing separately", () => {
    const layer = getMapLayers(data).find((l) => l.key === "public_admissions")!;
    expect(layer.kind).toBe("hospital");
    if (layer.kind !== "hospital") throw new Error("Expected hospital");
    expect(layer.domain).toEqual([50,100,200]);
    expect(Math.log(100)-Math.log(50)).toBeCloseTo(Math.log(200)-Math.log(100));
    const expression = JSON.stringify(colorExpression(layer));
    expect(expression).toContain('"typeof"');
    expect(expression).not.toContain("count");
  });
  const hospitalData = { ...data, hospital: { towns: {
    A: { phaCode: "1", values: {public_admissions: {status:"available", sr:123}, pph: {status:"suppressed",sr:null}} },
    B: { phaCode: "1", values: {public_admissions: {status:"available", sr:123}, pph: {status:"available",sr:145}} },
    C: { phaCode: null, values: {public_admissions: {status:"available", sr:123}, pph: {status:"not_interpretable",sr:0}} },
  }}} as unknown as AtlasData;
  it("uses only available positive SR and never turns missing into zero", () => {
    expect(hospitalMapValues(hospitalData,"A")).toEqual({public_admissions:123, pph:null});
    expect(hospitalMapValues(hospitalData,"C").pph).toBeNull();
    expect(hospitalMapValues(hospitalData,"unknown").public_admissions).toBeNull();
  });
  it("highlights supplied source PHA peers, never coincident values or suppressed measures", () => {
    expect(sharedHospitalTowns(hospitalData,"A","public_admissions")).toEqual(["B"]);
    expect(sharedHospitalTowns(hospitalData,"A","pph")).toEqual([]);
    expect(sharedHospitalTowns(hospitalData,"C","public_admissions")).toEqual([]);
    expect(sharedHospitalTowns(hospitalData,null,"public_admissions")).toEqual([]);
  });
});
