/** Shape of public/data/assistant_index.json (built by scripts/build_assistant_index.py). */

export type HospitalKey = "public_admissions" | "pph";
export type HospitalStatus = "available" | "suppressed" | "not_available" | "not_interpretable";

export interface HospitalValue {
  status: HospitalStatus;
  sr: number | null;
}

export interface IndexTown {
  code: string;
  name: string;
  display: string;
  state: string;
  stateName: string;
  pop: number;
  remoteness: string;
  ten4ten: boolean;
  alias: string | null;
  /** indicator key -> [percent, numerator, denominator] */
  ind: Record<string, [number, number, number]>;
  hosp: { phaCode: string | null; phaName: string | null } & Record<HospitalKey, HospitalValue>;
}

export interface IndexStats {
  median: number;
  q1: number;
  q3: number;
  p10: number;
  p90: number;
  n: number;
}

export interface IndexIndicator {
  key: string;
  label: string;
  shortLabel: string;
  unit: string;
  category: "health" | "context";
  mapLayer: boolean;
  denominatorLabel: string;
  description: string;
  definition: string;
  caveats: string[];
  source: string;
  nationalStats: IndexStats;
  remotenessStats: Record<string, IndexStats>;
}

export interface AtlasIndex {
  version: number;
  generatedAt: string;
  siteUrl: string;
  scope: { definition: string; minPopulation: number; maxPopulation: number; townCount: number };
  links: {
    healthLayerKeys: string[];
    hospitalLayerKeys: HospitalKey[];
    remotenessLayerKey: string;
    defaultLayer: string;
  };
  states: Array<{ name: string; abbr: string }>;
  remotenessOrder: string[];
  indicators: Record<string, IndexIndicator>;
  hospital: {
    measure: string;
    indicators: Record<HospitalKey, { label: string; period: string; definition: string }>;
    caveats: string[];
    statusText: Record<string, string>;
    licence: { name: string; url: string; attribution: string };
  };
  towns: IndexTown[];
}

export interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  OPENAI_REASONING_EFFORT?: string;
  ATLAS_BASE_URL?: string;
  ALLOWED_ORIGINS?: string;
  ALLOW_NO_ORIGIN?: string;
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
