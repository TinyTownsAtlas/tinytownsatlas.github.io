export interface Town {
  ucl_code: string;
  ucl_name: string;
  state_code: number;
  state_name: string;
  remoteness_code: number;
  remoteness_name: string;
  population: number;
  scope: "primary" | "reference_only";
  lon: number;
  lat: number;
  [indicatorKey: string]: string | number;
}

export interface IndicatorStats {
  median: number;
  q1: number;
  q3: number;
  p10: number;
  p90: number;
  n: number;
}

export interface Indicator {
  key: string;
  label: string;
  shortLabel: string;
  unit: "percent";
  precision: number;
  numeratorField: string;
  denominatorField: string;
  denominatorLabel: string;
  category: "health" | "context";
  isDefaultMapLayer: boolean;
  isRankable: false;
  colorScale: "sequential";
  domain: [number, number];
  description: string;
  caveats: string[];
  source: string;
  nationalStats: IndicatorStats;
  remotenessStats: Record<string, IndicatorStats>;
}

export interface Manifest {
  generatedAt: string;
  sources: Array<{
    name: string;
    doi?: string;
    license: string;
    attribution: string;
    rowCount?: number;
    matchedCount?: number;
  }>;
  scopeDefinition: string;
  primaryCount: number;
  referenceCount: number;
  defaultMapLayer: string;
  remotenessOrder: string[];
}

/** Display-only community tag (e.g. Ten4Ten). Never affects scope, comparators or statistics. */
export interface CommunityTag {
  label: string;
  uclCodes: Set<string>;
}

export interface AtlasData {
  towns: Town[];
  townsByCode: Map<string, Town>;
  indicators: Record<string, Indicator>;
  manifest: Manifest;
  pointsGeoJSON: GeoJSON.FeatureCollection;
  ten4ten: CommunityTag;
}

const base = import.meta.env.BASE_URL;

export async function loadAtlasData(): Promise<AtlasData> {
  const [towns, indicators, manifest, pointsGeoJSON, ten4ten] = await Promise.all([
    fetch(`${base}data/towns.json`).then((r) => r.json() as Promise<Town[]>),
    fetch(`${base}data/indicators.json`).then((r) => r.json() as Promise<Record<string, Indicator>>),
    fetch(`${base}data/manifest.json`).then((r) => r.json() as Promise<Manifest>),
    fetch(`${base}data/towns.geojson`).then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
    fetch(`${base}data/ten4ten.json`).then(
      (r) => r.json() as Promise<{ label: string; uclCodes: string[] }>,
    ),
  ]);

  const townsByCode = new Map(towns.map((t) => [t.ucl_code, t]));

  return {
    towns,
    townsByCode,
    indicators,
    manifest,
    pointsGeoJSON,
    ten4ten: { label: ten4ten.label, uclCodes: new Set(ten4ten.uclCodes) },
  };
}
