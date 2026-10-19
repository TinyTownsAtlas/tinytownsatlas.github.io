/**
 * Deterministic Atlas queries. The model picks a tool and arguments; every number it quotes comes
 * from these functions. Nothing here builds a composite score or ranks by anything other than the
 * single measure the user asked about.
 */
import type { AtlasIndex, HospitalKey, IndexTown } from "./types";

export const HOSPITAL_KEYS: HospitalKey[] = ["public_admissions", "pph"];
/** Descriptive context only: shown in profiles and comparisons, never sorted or filtered on. */
export const DESCRIPTIVE_ONLY = new Set(["indigenous_pct"]);
/** Percent measures with a denominator under this are flagged as small-number results. */
export const SMALL_DENOMINATOR = 300;
export const MAX_TOP_N = 10;
export const MAX_FILTER_ROWS = 15;

export type ToolResult = Record<string, unknown>;

export const COMPOSITE_MESSAGE =
  "The Atlas does not define a single overall health score, so towns cannot be ordered as healthiest or unhealthiest. " +
  "I can compare towns on a specific measure such as diabetes, asthma, mental health, cancer or hospital admissions.";

// ---------- text helpers ----------

export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function quantile(sorted: number[], p: number): number {
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ---------- prepared lookups ----------

interface Prepared {
  byCode: Map<string, IndexTown>;
  entries: Array<{ town: IndexTown; display: string; full: string; alias: string | null }>;
  stateByPhrase: Array<[string, string]>; // normalised phrase -> abbr, longest first
}

const preparedCache = new WeakMap<AtlasIndex, Prepared>();

function prepare(idx: AtlasIndex): Prepared {
  let p = preparedCache.get(idx);
  if (p) return p;
  const phrases: Array<[string, string]> = [];
  for (const s of idx.states) {
    phrases.push([normalize(s.name), s.abbr], [normalize(s.abbr), s.abbr]);
  }
  phrases.sort((a, b) => b[0].length - a[0].length);
  p = {
    byCode: new Map(idx.towns.map((t) => [t.code, t])),
    entries: idx.towns.map((t) => ({
      town: t,
      display: normalize(t.display),
      full: normalize(t.name),
      alias: t.alias ? normalize(t.alias) : null,
    })),
    stateByPhrase: phrases,
  };
  preparedCache.set(idx, p);
  return p;
}

/** "WA", "wa", "Western Australia" -> "WA"; unknown -> null. */
export function resolveState(idx: AtlasIndex, input: string | null | undefined): string | null {
  if (!input) return null;
  const q = normalize(input);
  return prepare(idx).stateByPhrase.find(([phrase]) => phrase === q)?.[1] ?? null;
}

export function resolveRemoteness(idx: AtlasIndex, input: string | null | undefined): string | null {
  if (!input) return null;
  const q = normalize(input).replace(/ australia$/, "").replace(/ of$/, "");
  return (
    idx.remotenessOrder.find((r) => normalize(r).replace(/ australia$/, "").replace(/ of$/, "") === q) ??
    idx.remotenessOrder.find((r) => normalize(r).startsWith(q)) ??
    null
  );
}

// ---------- town resolution ----------

export interface TownMatch {
  status: "exact" | "ambiguous" | "approximate" | "not_found";
  towns: IndexTown[];
}

export function resolveTowns(idx: AtlasIndex, query: string, stateHint?: string | null): TownMatch {
  const p = prepare(idx);
  const raw = query.trim();
  if (/^ucl\d+$/i.test(raw)) {
    const t = p.byCode.get(raw.toUpperCase());
    return t ? { status: "exact", towns: [t] } : { status: "not_found", towns: [] };
  }
  let q = normalize(raw);
  let state = resolveState(idx, stateHint);
  for (const [phrase, abbr] of p.stateByPhrase) {
    if (q.endsWith(` ${phrase}`)) {
      q = q.slice(0, -phrase.length - 1).trim();
      state ??= abbr;
      break;
    }
    if (q.startsWith(`${phrase} `)) {
      q = q.slice(phrase.length + 1).trim();
      state ??= abbr;
      break;
    }
  }
  q = q.replace(/ l$/, "");
  if (!q) return { status: "not_found", towns: [] };
  const inState = p.entries.filter((e) => !state || e.town.state === state);
  const exact = inState.filter((e) => e.display === q || e.full === q || e.alias === q);
  if (exact.length === 1) return { status: "exact", towns: [exact[0].town] };
  if (exact.length > 1) return { status: "ambiguous", towns: exact.map((e) => e.town) };
  const prefix = inState.filter((e) => e.display.startsWith(q) || (e.alias?.startsWith(q) ?? false));
  const loose = prefix.length
    ? prefix
    : inState.filter((e) => e.display.includes(q) || (e.alias?.includes(q) ?? false));
  loose.sort((a, b) => a.display.localeCompare(b.display) || a.town.state.localeCompare(b.town.state));
  return loose.length
    ? { status: "approximate", towns: loose.slice(0, 8).map((e) => e.town) }
    : { status: "not_found", towns: [] };
}

// ---------- links ----------

/** Deep link into the Atlas (same ?town=&layer= scheme the site itself writes to the URL). */
export function townLink(idx: AtlasIndex, town: IndexTown | null, indicatorKey?: string | null): string {
  const params = new URLSearchParams();
  if (town) params.set("town", town.code);
  if (indicatorKey) {
    const isLayer =
      idx.links.healthLayerKeys.includes(indicatorKey) ||
      (idx.links.hospitalLayerKeys as string[]).includes(indicatorKey);
    if (isLayer) params.set("layer", indicatorKey);
  }
  const query = params.toString();
  return `${idx.siteUrl}${query ? `?${query}` : ""}`;
}

function brief(idx: AtlasIndex, t: IndexTown): ToolResult {
  return {
    name: t.name,
    state: t.state,
    code: t.code,
    population: t.pop,
    remoteness: t.remoteness,
    ...(t.ten4ten ? { ten4tenCommunity: t.alias ?? true } : {}),
    link: townLink(idx, t),
  };
}

function geographyNote(t: IndexTown): string | null {
  return t.alias ? `Figures are for the UCL "${t.name}", not for the whole of ${t.alias}.` : null;
}

// ---------- values ----------

function isHospital(key: string): key is HospitalKey {
  return (HOSPITAL_KEYS as string[]).includes(key);
}

function indicatorError(idx: AtlasIndex, key: string): ToolResult {
  if (/overall|composite|score|index|healthiest|unhealthiest|total/i.test(key)) {
    return { error: "no_composite", message: COMPOSITE_MESSAGE };
  }
  return {
    error: "unknown_indicator",
    message: `Unknown measure "${key}".`,
    validMeasures: [...Object.keys(idx.indicators), ...HOSPITAL_KEYS],
  };
}

function censusValue(idx: AtlasIndex, t: IndexTown, key: string): ToolResult {
  const ind = idx.indicators[key];
  const [pct, count, denom] = t.ind[key];
  return {
    measure: ind.shortLabel,
    percent: pct,
    text: `${pct.toFixed(1)}% (${count} of ${denom} ${ind.denominatorLabel})`,
    ...(denom < SMALL_DENOMINATOR ? { smallDenominator: true } : {}),
  };
}

export function srVsAustralia(sr: number): string {
  const diff = round1(sr - 100);
  if (diff === 0) return "equal to the Australian level (100)";
  return `${Math.abs(diff)}% ${diff > 0 ? "above" : "below"} the Australian level (100)`;
}

function hospitalValue(idx: AtlasIndex, t: IndexTown, key: HospitalKey): ToolResult {
  const meta = idx.hospital.indicators[key];
  const v = t.hosp[key];
  const base = { measure: meta.label, key, period: meta.period, status: v.status };
  if (v.status === "available" && v.sr !== null) {
    return {
      ...base,
      sr: v.sr,
      text: `SR ${v.sr.toFixed(1)} (Australia = 100): ${srVsAustralia(v.sr)}`,
    };
  }
  return { ...base, sr: null, text: idx.hospital.statusText[v.status] ?? v.status };
}

function measureValue(idx: AtlasIndex, t: IndexTown, key: string): ToolResult {
  return isHospital(key) ? hospitalValue(idx, t, key) : censusValue(idx, t, key);
}

/** Numeric value used for sorting/filtering, or null when the town has none for this measure. */
function sortValue(t: IndexTown, key: string): number | null {
  if (isHospital(key)) {
    const v = t.hosp[key];
    return v.status === "available" ? v.sr : null;
  }
  return t.ind[key]?.[0] ?? null;
}

function measureLabel(idx: AtlasIndex, key: string): string {
  return isHospital(key) ? idx.hospital.indicators[key].label : idx.indicators[key].label;
}

// ---------- universe filter ----------

export interface Scope {
  state?: string | null;
  remoteness?: string | null;
  min_population?: number | null;
  max_population?: number | null;
}

function scopeTowns(
  idx: AtlasIndex,
  s: Scope,
): { towns: IndexTown[]; applied: Record<string, unknown> } | { error: ToolResult } {
  const applied: Record<string, unknown> = {};
  let state: string | null = null;
  if (s.state) {
    state = resolveState(idx, s.state);
    if (!state) {
      return {
        error: {
          error: "unknown_state",
          message: `Unknown state or territory "${s.state}".`,
          valid: idx.states.map((x) => x.abbr),
        },
      };
    }
    applied.state = state;
  }
  let remoteness: string | null = null;
  if (s.remoteness) {
    remoteness = resolveRemoteness(idx, s.remoteness);
    if (!remoteness) {
      return {
        error: { error: "unknown_remoteness", message: `Unknown remoteness class "${s.remoteness}".`, valid: idx.remotenessOrder },
      };
    }
    applied.remoteness = remoteness;
  }
  const min = s.min_population ?? null;
  const max = s.max_population ?? null;
  if (min !== null) applied.minPopulation = min;
  if (max !== null) applied.maxPopulation = max;
  const towns = idx.towns.filter(
    (t) =>
      (!state || t.state === state) &&
      (!remoteness || t.remoteness === remoteness) &&
      (min === null || t.pop >= min) &&
      (max === null || t.pop <= max),
  );
  return { towns, applied };
}

const scopeNote = (idx: AtlasIndex) =>
  `Universe: Atlas towns with ${idx.scope.minPopulation.toLocaleString("en-AU")}-${idx.scope.maxPopulation.toLocaleString("en-AU")} usual residents.`;

// ---------- tools ----------

export function findTown(idx: AtlasIndex, a: { query: string; state?: string | null }): ToolResult {
  const m = resolveTowns(idx, a.query, a.state);
  return { status: m.status, matches: m.towns.map((t) => brief(idx, t)) };
}

function resolveOne(
  idx: AtlasIndex,
  query: string,
  state?: string | null,
): { town: IndexTown } | { problem: ToolResult } {
  const m = resolveTowns(idx, query, state);
  if (m.status === "exact") return { town: m.towns[0] };
  return {
    problem: {
      error: m.status === "not_found" ? "town_not_found" : "town_not_unique",
      query,
      message:
        m.status === "not_found"
          ? `No Atlas town matches "${query}".`
          : `"${query}" matches more than one town; ask which is meant.`,
      matches: m.towns.map((t) => brief(idx, t)),
    },
  };
}

export function getTownProfile(idx: AtlasIndex, a: { town: string; state?: string | null }): ToolResult {
  const r = resolveOne(idx, a.town, a.state);
  if ("problem" in r) return r.problem;
  const t = r.town;
  const health: ToolResult[] = [];
  const context: ToolResult[] = [];
  for (const [key, ind] of Object.entries(idx.indicators)) {
    const entry = {
      key,
      ...censusValue(idx, t, key),
      nationalMedian: ind.nationalStats.median,
      sameRemotenessMedian: ind.remotenessStats[t.remoteness]?.median ?? null,
      ...(DESCRIPTIVE_ONLY.has(key) ? { note: "Descriptive Census context only." } : {}),
    };
    (ind.category === "health" ? health : context).push(entry);
  }
  return {
    town: brief(idx, t),
    geographyNote: geographyNote(t),
    censusHealthConditions: health,
    peopleAndContext: context,
    hospitalServices: HOSPITAL_KEYS.map((k) => hospitalValue(idx, t, k)),
    hospitalNote: t.hosp.phaCode
      ? "Hospital figures are Population Health Area estimates assigned to the town in proportion to population, not town hospital records."
      : "Hospital figures are PHIDU estimates for a wider area that PHIDU did not identify for this town, so no area is named; they are not town hospital records.",
    notes: ["Census percentages are not age-standardised and rest on small denominators.", "Medians are across Atlas towns."],
  };
}

export function compareTowns(idx: AtlasIndex, a: { towns: string[]; indicators: string[] }): ToolResult {
  const resolved: IndexTown[] = [];
  const problems: ToolResult[] = [];
  for (const q of a.towns.slice(0, 4)) {
    const r = resolveOne(idx, q);
    if ("problem" in r) problems.push(r.problem);
    else if (!resolved.includes(r.town)) resolved.push(r.town);
  }
  if (problems.length) return { error: "unresolved_town", problems };
  if (resolved.length < 2) return { error: "need_two_towns", message: "Compare needs at least two different towns." };
  const keys = a.indicators.length ? a.indicators : [...idx.links.healthLayerKeys, ...HOSPITAL_KEYS];
  const measures: ToolResult[] = [];
  for (const key of keys) {
    if (!idx.indicators[key] && !isHospital(key)) return indicatorError(idx, key);
    measures.push({
      key,
      label: measureLabel(idx, key),
      values: resolved.map((t) => ({ town: t.name, state: t.state, ...measureValue(idx, t, key) })),
      ...(idx.indicators[key] ? { nationalMedian: idx.indicators[key].nationalStats.median } : {}),
      ...(DESCRIPTIVE_ONLY.has(key) ? { note: "Descriptive Census context only." } : {}),
    });
  }
  return {
    towns: resolved.map((t) => ({ ...brief(idx, t), geographyNote: geographyNote(t) })),
    measures,
    notes: [
      "Census percentages are not age-standardised; read them with the denominators shown.",
      "Hospital figures are wider-area PHA estimates (SR, Australia = 100).",
    ],
  };
}

function refuseRankOrFilter(idx: AtlasIndex, key: string): ToolResult | null {
  if (!idx.indicators[key] && !isHospital(key)) return indicatorError(idx, key);
  if (DESCRIPTIVE_ONLY.has(key)) {
    return {
      error: "descriptive_only",
      message: `${idx.indicators[key].label} is descriptive Census context in the Atlas. It is not used to sort or filter towns, but it is shown in each town profile.`,
    };
  }
  return null;
}

function townRow(idx: AtlasIndex, t: IndexTown, key: string): ToolResult {
  return {
    ...brief(idx, t),
    ...(isHospital(key) ? { phaName: t.hosp.phaName } : {}),
    value: measureValue(idx, t, key),
  };
}

export function rankTowns(
  idx: AtlasIndex,
  a: { indicator: string; direction: "highest" | "lowest"; top_n?: number | null } & Scope,
): ToolResult {
  const refused = refuseRankOrFilter(idx, a.indicator);
  if (refused) return refused;
  const scoped = scopeTowns(idx, a);
  if ("error" in scoped) return scoped.error;
  const hospital = isHospital(a.indicator);
  const withValue = scoped.towns.filter((t) => sortValue(t, a.indicator) !== null);
  const sign = a.direction === "highest" ? -1 : 1;
  withValue.sort((x, y) => {
    const d = sign * (sortValue(x, a.indicator)! - sortValue(y, a.indicator)!);
    if (d) return d;
    // Ties: larger denominator first, then larger population, then name, so output is stable.
    return (
      (hospital ? 0 : y.ind[a.indicator][2] - x.ind[a.indicator][2]) || y.pop - x.pop || x.name.localeCompare(y.name)
    );
  });
  const n = Math.min(Math.max(Math.floor(a.top_n ?? 5), 1), MAX_TOP_N);
  const top = withValue.slice(0, n);
  const notes = [
    "Sorted on this single measure only; this is not an overall ranking or a judgement about any town.",
    scopeNote(idx),
  ];
  if (hospital) {
    notes.push(
      "Towns in the same Population Health Area share one ratio, so ties are expected. These are wider-area estimates, not town observations.",
    );
  } else if (top.some((t) => t.ind[a.indicator][2] < SMALL_DENOMINATOR)) {
    notes.push(`Some results rest on fewer than ${SMALL_DENOMINATOR} residents, where a handful of people can move the percentage.`);
  }
  return {
    measure: measureLabel(idx, a.indicator),
    direction: a.direction,
    appliedFilters: scoped.applied,
    townsInScope: scoped.towns.length,
    townsWithPublishedValue: withValue.length,
    towns: top.map((t, i) => ({ order: i + 1, ...townRow(idx, t, a.indicator) })),
    notes,
  };
}

type Op = "gt" | "gte" | "lt" | "lte" | "top_quartile" | "bottom_quartile";

export interface Condition {
  indicator: string;
  op: Op;
  value: number | null;
}

export function filterTowns(
  idx: AtlasIndex,
  a: {
    conditions: Condition[];
    sort_by?: string | null;
    sort_direction?: "highest" | "lowest" | null;
    limit?: number | null;
  } & Scope,
): ToolResult {
  const scoped = scopeTowns(idx, a);
  if ("error" in scoped) return scoped.error;
  const tests: Array<{ pass: (t: IndexTown) => boolean; text: string }> = [];
  for (const c of a.conditions) {
    const refused = refuseRankOrFilter(idx, c.indicator);
    if (refused) return refused;
    let threshold = c.value;
    let op = c.op;
    if (op === "top_quartile" || op === "bottom_quartile") {
      if (isHospital(c.indicator)) {
        return {
          error: "bad_condition",
          message: "Quartiles are not defined for hospital SR measures. Use a numeric threshold (Australia = 100).",
        };
      }
      const stats = idx.indicators[c.indicator].nationalStats;
      threshold = op === "top_quartile" ? stats.q3 : stats.q1;
      op = op === "top_quartile" ? "gte" : "lte";
    } else if (threshold === null || !Number.isFinite(threshold)) {
      return { error: "bad_condition", message: `Condition on ${c.indicator} needs a numeric value.` };
    }
    const th = threshold as number;
    const cmp = {
      gt: (v: number) => v > th,
      gte: (v: number) => v >= th,
      lt: (v: number) => v < th,
      lte: (v: number) => v <= th,
    }[op];
    const symbol = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[op];
    tests.push({
      pass: (t) => {
        const v = sortValue(t, c.indicator);
        return v !== null && cmp(v);
      },
      text: `${measureLabel(idx, c.indicator)} ${symbol} ${th}${isHospital(c.indicator) ? " (SR)" : "%"}`,
    });
  }
  const matches = scoped.towns.filter((t) => tests.every((x) => x.pass(t)));
  const sortKey = a.sort_by ?? null;
  if (sortKey) {
    const refused = refuseRankOrFilter(idx, sortKey);
    if (refused) return refused;
    const sign = (a.sort_direction ?? "highest") === "highest" ? -1 : 1;
    matches.sort(
      (x, y) =>
        sign * ((sortValue(x, sortKey) ?? 0) - (sortValue(y, sortKey) ?? 0)) ||
        y.pop - x.pop ||
        x.name.localeCompare(y.name),
    );
  } else {
    matches.sort((x, y) => y.pop - x.pop || x.name.localeCompare(y.name));
  }
  const limit = Math.min(Math.max(Math.floor(a.limit ?? 10), 1), MAX_FILTER_ROWS);
  const shownKeys = [...new Set([...a.conditions.map((c) => c.indicator), ...(sortKey ? [sortKey] : [])])];
  return {
    conditions: tests.map((t) => t.text),
    appliedFilters: scoped.applied,
    townsInScope: scoped.towns.length,
    totalMatches: matches.length,
    shown: Math.min(limit, matches.length),
    sortedBy: sortKey ? `${measureLabel(idx, sortKey)} (${a.sort_direction ?? "highest"} first)` : "population (largest first)",
    towns: matches.slice(0, limit).map((t) => ({
      ...brief(idx, t),
      values: shownKeys.map((k) => ({ key: k, ...measureValue(idx, t, k) })),
    })),
    notes: [
      scopeNote(idx),
      "A filter lists towns meeting the stated conditions; it is not a ranking or a judgement about any town.",
      ...(shownKeys.some(isHospital) ? ["Hospital values are wider-area PHA estimates, not town records."] : []),
    ],
  };
}

export function summarizeIndicator(idx: AtlasIndex, a: { indicator: string } & Scope): ToolResult {
  if (isHospital(a.indicator)) {
    return {
      error: "no_hospital_distribution",
      message:
        "The Atlas does not publish distributions of the hospital SR measures, because towns in one Population Health Area share a single estimate. Use rank, filter or a town's own value instead.",
    };
  }
  const refused = refuseRankOrFilter(idx, a.indicator);
  if (refused) return refused;
  const scoped = scopeTowns(idx, a);
  if ("error" in scoped) return scoped.error;
  const vals = scoped.towns.map((t) => ({ t, v: t.ind[a.indicator][0] })).sort((x, y) => x.v - y.v);
  if (!vals.length) return { error: "no_towns", message: "No towns match those filters.", appliedFilters: scoped.applied };
  const sorted = vals.map((x) => x.v);
  const lo = vals[0];
  const hi = vals[vals.length - 1];
  return {
    measure: idx.indicators[a.indicator].label,
    appliedFilters: scoped.applied,
    towns: vals.length,
    minPercent: round1(lo.v),
    q1: round1(quantile(sorted, 0.25)),
    medianPercent: round1(quantile(sorted, 0.5)),
    q3: round1(quantile(sorted, 0.75)),
    maxPercent: round1(hi.v),
    lowestTown: brief(idx, lo.t),
    highestTown: brief(idx, hi.t),
    notes: [scopeNote(idx), "Summary of observed town percentages; not age-standardised and based on small denominators."],
  };
}

export function explainIndicator(idx: AtlasIndex, a: { indicator: string; sr_value?: number | null }): ToolResult {
  if (a.indicator === "remoteness") {
    return {
      topic: "Remoteness (ABS Remoteness Area)",
      townsByRemoteness: idx.remotenessOrder.map((r) => ({
        remoteness: r,
        towns: idx.towns.filter((t) => t.remoteness === r).length,
      })),
      link: `${idx.siteUrl}?layer=${idx.links.remotenessLayerKey}`,
      note: "The definition is in the assistant context.",
    };
  }
  if (isHospital(a.indicator)) {
    const meta = idx.hospital.indicators[a.indicator];
    return {
      measure: meta.label,
      period: meta.period,
      definition: meta.definition,
      scale: idx.hospital.measure,
      caveats: idx.hospital.caveats,
      statusMeanings: idx.hospital.statusText,
      attribution: idx.hospital.licence.attribution,
      ...(a.sr_value !== undefined && a.sr_value !== null
        ? {
            interpretation: `An SR of ${a.sr_value} is ${srVsAustralia(a.sr_value)} after allowing for age. It is a ratio for the wider Population Health Area, not a count of admissions or a town-level observation.`,
          }
        : {}),
      link: `${idx.siteUrl}?layer=${a.indicator}`,
    };
  }
  const ind = idx.indicators[a.indicator];
  if (!ind) return indicatorError(idx, a.indicator);
  return {
    measure: ind.label,
    category: ind.category,
    definition: ind.definition,
    description: ind.description,
    denominatorIs: ind.denominatorLabel,
    caveats: ind.caveats,
    source: ind.source,
    nationalDistribution: ind.nationalStats,
    link: ind.mapLayer ? `${idx.siteUrl}?layer=${a.indicator}` : idx.siteUrl,
  };
}

export function getHospitalContext(idx: AtlasIndex, a: { town: string; state?: string | null }): ToolResult {
  const r = resolveOne(idx, a.town, a.state);
  if ("problem" in r) return r.problem;
  const t = r.town;
  const peers = (key: HospitalKey) =>
    t.hosp.phaCode && t.hosp[key].status === "available"
      ? idx.towns.filter((o) => o !== t && o.hosp.phaCode === t.hosp.phaCode && o.hosp[key].status === "available")
      : [];
  return {
    town: brief(idx, t),
    geographyNote: geographyNote(t),
    populationHealthArea: t.hosp.phaCode
      ? { code: t.hosp.phaCode, name: t.hosp.phaName }
      : "Not identified: PHIDU did not supply a Population Health Area for this town, so no area name or peers are given.",
    measures: HOSPITAL_KEYS.map((k) => ({
      ...hospitalValue(idx, t, k),
      otherAtlasTownsWithSameAreaAndPublishedValue: peers(k).length,
      examples: peers(k).slice(0, 6).map((o) => o.name),
      link: townLink(idx, t, k),
    })),
    scale: idx.hospital.measure,
    caveats: idx.hospital.caveats,
    attribution: idx.hospital.licence.attribution,
  };
}

export const TOOL_NAMES = [
  "find_town",
  "get_town_profile",
  "compare_towns",
  "rank_towns",
  "filter_towns",
  "summarize_indicator",
  "explain_indicator",
  "get_hospital_context",
] as const;

export function runTool(idx: AtlasIndex, name: string, args: unknown): ToolResult {
  try {
    const a = (args ?? {}) as Record<string, any>;
    switch (name) {
      case "find_town":
        return findTown(idx, a as any);
      case "get_town_profile":
        return getTownProfile(idx, a as any);
      case "compare_towns":
        return compareTowns(idx, { towns: a.towns ?? [], indicators: a.indicators ?? [] });
      case "rank_towns":
        return rankTowns(idx, a as any);
      case "filter_towns":
        return filterTowns(idx, { ...a, conditions: a.conditions ?? [] } as any);
      case "summarize_indicator":
        return summarizeIndicator(idx, a as any);
      case "explain_indicator":
        return explainIndicator(idx, a as any);
      case "get_hospital_context":
        return getHospitalContext(idx, a as any);
      default:
        return { error: "unknown_tool", message: `No tool named ${name}.` };
    }
  } catch (err) {
    return { error: "tool_failed", message: err instanceof Error ? err.message : "Tool failed." };
  }
}
