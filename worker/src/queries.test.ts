import { describe, expect, it } from "vitest";
import {
  compareTowns,
  explainIndicator,
  filterTowns,
  findTown,
  getHospitalContext,
  getTownProfile,
  rankTowns,
  resolveTowns,
  runTool,
  summarizeIndicator,
  townLink,
} from "./queries";
import { loadTestIndex } from "./testIndex";

const idx = loadTestIndex();
const q = (r: Record<string, any>) => r as any;

describe("town lookup", () => {
  it("finds an exact town and builds a deep link", () => {
    const m = resolveTowns(idx, "Brewarrina");
    expect(m.status).toBe("exact");
    expect(m.towns[0].code).toBe("UCL121013");
    expect(townLink(idx, m.towns[0])).toBe("https://tinytownsatlas.github.io/?town=UCL121013");
  });

  it("is case-insensitive and accepts the full UCL name or a UCL code", () => {
    expect(resolveTowns(idx, "WILCANNIA (L)").towns[0].display).toBe("Wilcannia");
    expect(resolveTowns(idx, "ucl121013").towns[0].display).toBe("Brewarrina");
  });

  it("treats a town shared by two states as ambiguous unless a state is given", () => {
    expect(resolveTowns(idx, "Laura").status).toBe("ambiguous");
    const qld = resolveTowns(idx, "Laura QLD");
    expect(qld.status).toBe("exact");
    expect(qld.towns[0].state).toBe("QLD");
    expect(resolveTowns(idx, "Laura", "South Australia").towns[0].state).toBe("SA");
    expect(resolveTowns(idx, "Laura (Qld)").towns[0].state).toBe("QLD");
  });

  it("resolves King Island to Currie and notes the geography", () => {
    const m = resolveTowns(idx, "King Island");
    expect(m.towns.map((t) => t.name)).toEqual(["Currie (L)"]);
    expect(q(getTownProfile(idx, { town: "King Island" })).geographyNote).toContain("not for the whole of King Island");
  });

  it("returns candidates for partial names and not_found for nonsense", () => {
    expect(resolveTowns(idx, "Brewar").status).toBe("approximate");
    expect(findTown(idx, { query: "Zzzzqqq" })).toEqual({ status: "not_found", matches: [] });
  });
});

describe("profiles and Census values", () => {
  it("reports Brewarrina diabetes with numerator and denominator (QuickStats anchor)", () => {
    const p = q(getTownProfile(idx, { town: "Brewarrina" }));
    const diabetes = p.censusHealthConditions.find((c: any) => c.key === "diabetes_pct");
    expect(diabetes.percent).toBe(7.0);
    expect(diabetes.text).toBe("7.0% (52 of 743 usual residents)");
    const unemployment = p.peopleAndContext.find((c: any) => c.key === "unemployment_rate_pct");
    expect(unemployment.text).toBe("5.1% (13 of 254 labour force (15+))".replace("labour force (15+)", idx.indicators.unemployment_rate_pct.denominatorLabel));
    expect(p.peopleAndContext.find((c: any) => c.key === "indigenous_pct").note).toMatch(/descriptive/i);
  });

  it("does not describe an unidentified area for Currie in the profile", () => {
    expect(q(getTownProfile(idx, { town: "Currie" })).hospitalNote).toMatch(/did not identify/);
    expect(q(getTownProfile(idx, { town: "Brewarrina" })).hospitalNote).toMatch(/Population Health Area estimates/);
  });

  it("asks which town is meant instead of guessing", () => {
    const p = q(getTownProfile(idx, { town: "Laura" }));
    expect(p.error).toBe("town_not_unique");
    expect(p.matches).toHaveLength(2);
  });
});

describe("compare_towns", () => {
  it("compares two towns on chosen measures", () => {
    const r = q(compareTowns(idx, { towns: ["Brewarrina", "Wilcannia"], indicators: ["diabetes_pct", "mental_health_pct"] }));
    expect(r.measures).toHaveLength(2);
    expect(r.measures[0].values.map((v: any) => v.town)).toEqual(["Brewarrina (L)", "Wilcannia (L)"]);
    expect(r.measures[0].values[0].text).toContain("52 of 743");
  });

  it("defaults to ten conditions plus both hospital measures", () => {
    const r = q(compareTowns(idx, { towns: ["Brewarrina", "Wilcannia"], indicators: [] }));
    expect(r.measures).toHaveLength(12);
  });

  it("refuses a composite measure and unresolved towns", () => {
    expect(q(compareTowns(idx, { towns: ["Brewarrina", "Wilcannia"], indicators: ["overall_health_score"] })).error).toBe("no_composite");
    expect(q(compareTowns(idx, { towns: ["Brewarrina", "Nowhereville"], indicators: [] })).error).toBe("unresolved_town");
    expect(q(compareTowns(idx, { towns: ["Brewarrina"], indicators: [] })).error).toBe("need_two_towns");
  });
});

describe("rank_towns", () => {
  it("returns the highest asthma shares in WA, sorted and within WA", () => {
    const r = q(rankTowns(idx, { indicator: "asthma_pct", direction: "highest", state: "WA", top_n: 5 }));
    expect(r.towns).toHaveLength(5);
    expect(r.towns.every((t: any) => t.state === "WA")).toBe(true);
    const values = r.towns.map((t: any) => t.value.percent);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    const wa = idx.towns.filter((t) => t.state === "WA").map((t) => t.ind.asthma_pct[0]);
    expect(values[0]).toBe(Math.max(...wa));
    expect(r.towns[0].value.text).toMatch(/\d+\.\d% \(\d+ of \d+ usual residents\)/);
    expect(r.notes.join(" ")).toMatch(/not an overall ranking/);
  });

  it("returns the lowest values and caps top_n", () => {
    const r = q(rankTowns(idx, { indicator: "diabetes_pct", direction: "lowest", top_n: 99 }));
    expect(r.towns).toHaveLength(10);
    expect(r.towns[0].value.percent).toBe(Math.min(...idx.towns.map((t) => t.ind.diabetes_pct[0])));
  });

  it("flags small denominators in the result and the notes", () => {
    const r = q(rankTowns(idx, { indicator: "mental_health_pct", direction: "highest", max_population: 150, top_n: 5 }));
    expect(r.towns.every((t: any) => t.value.smallDenominator === true)).toBe(true);
    expect(r.notes.join(" ")).toMatch(/fewer than 300 residents/);
  });

  it("applies remoteness and population filters", () => {
    const r = q(rankTowns(idx, { indicator: "cancer_pct", direction: "highest", remoteness: "Very Remote", max_population: 300 }));
    expect(r.towns.every((t: any) => t.remoteness === "Very Remote Australia" && t.population <= 300)).toBe(true);
  });

  it("will not sort by Aboriginal and Torres Strait Islander share, or by a composite", () => {
    expect(q(rankTowns(idx, { indicator: "indigenous_pct", direction: "highest" })).error).toBe("descriptive_only");
    expect(q(rankTowns(idx, { indicator: "healthiest_town", direction: "highest" })).error).toBe("no_composite");
    expect(q(rankTowns(idx, { indicator: "overall_score", direction: "lowest" })).message).toMatch(/does not define a single overall health score/);
  });

  it("rejects an unknown state", () => {
    expect(q(rankTowns(idx, { indicator: "asthma_pct", direction: "highest", state: "ZZ" })).error).toBe("unknown_state");
  });
});

describe("filter_towns", () => {
  it("filters Tasmanian towns under 500 residents", () => {
    const r = q(filterTowns(idx, { conditions: [], state: "TAS", max_population: 499, limit: 15 }));
    const expected = idx.towns.filter((t) => t.state === "TAS" && t.pop <= 499).length;
    expect(r.totalMatches).toBe(expected);
    expect(r.towns.every((t: any) => t.population <= 499 && t.state === "TAS")).toBe(true);
  });

  it("combines low diabetes with high hospital admissions", () => {
    const r = q(
      filterTowns(idx, {
        conditions: [
          { indicator: "diabetes_pct", op: "bottom_quartile", value: null },
          { indicator: "public_admissions", op: "gt", value: 130 },
        ],
        sort_by: "public_admissions",
        sort_direction: "highest",
      }),
    );
    const q1 = idx.indicators.diabetes_pct.nationalStats.q1;
    const expected = idx.towns.filter(
      (t) => t.ind.diabetes_pct[0] <= q1 && t.hosp.public_admissions.status === "available" && t.hosp.public_admissions.sr! > 130,
    ).length;
    expect(r.totalMatches).toBe(expected);
    expect(r.totalMatches).toBeGreaterThan(0);
  });

  it("never treats missing hospital values as zero", () => {
    const suppressed = idx.towns.find((t) => t.hosp.pph.status === "suppressed")!;
    const r = q(filterTowns(idx, { conditions: [{ indicator: "pph", op: "lt", value: 1000 }], limit: 15, max_population: null }));
    const all = q(filterTowns(idx, { conditions: [{ indicator: "pph", op: "gte", value: 0 }], limit: 15 }));
    expect(all.totalMatches).toBe(idx.towns.filter((t) => t.hosp.pph.status === "available").length);
    expect(r.towns.map((t: any) => t.code)).not.toContain(suppressed.code);
  });

  it("rejects quartiles for hospital measures and non-numeric thresholds", () => {
    expect(q(filterTowns(idx, { conditions: [{ indicator: "pph", op: "top_quartile", value: null }] })).error).toBe("bad_condition");
    expect(q(filterTowns(idx, { conditions: [{ indicator: "pph", op: "gt", value: null }] })).error).toBe("bad_condition");
  });
});

describe("summarize_indicator", () => {
  it("reproduces the build-time national distribution", () => {
    const r = q(summarizeIndicator(idx, { indicator: "diabetes_pct" }));
    const stats = idx.indicators.diabetes_pct.nationalStats;
    expect(r.towns).toBe(stats.n);
    expect(Math.abs(r.medianPercent - stats.median)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(r.q1 - stats.q1)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(r.q3 - stats.q3)).toBeLessThanOrEqual(0.1);
  });

  it("does not summarise hospital measures", () => {
    expect(q(summarizeIndicator(idx, { indicator: "pph" })).error).toBe("no_hospital_distribution");
  });
});

describe("hospital context", () => {
  it("describes Brewarrina's measures as PHA-derived SR with Australia = 100", () => {
    const r = q(getHospitalContext(idx, { town: "Brewarrina" }));
    expect(r.populationHealthArea.name).toBe("Bourke - Brewarrina/ Walgett - Lightning Ridge");
    expect(r.measures[0].sr).toBe(156.6);
    expect(r.measures[0].text).toContain("Australia = 100");
    expect(r.measures[0].otherAtlasTownsWithSameAreaAndPublishedValue).toBeGreaterThan(0);
    expect(r.caveats.join(" ")).toMatch(/not hospital records for this town/);
  });

  it("does not infer an area for Currie / King Island", () => {
    const r = q(getHospitalContext(idx, { town: "Currie" }));
    expect(r.populationHealthArea).toMatch(/Not identified/);
    expect(r.measures[0].otherAtlasTownsWithSameAreaAndPublishedValue).toBe(0);
    expect(r.geographyNote).toContain("King Island");
  });

  it("keeps suppressed and not-interpretable statuses and never reports zero", () => {
    const suppressed = idx.towns.find((t) => t.hosp.pph.status === "suppressed")!;
    const s = q(getHospitalContext(idx, { town: suppressed.code }));
    expect(s.measures[1].status).toBe("suppressed");
    expect(s.measures[1].sr).toBeNull();
    expect(s.measures[1].text).toMatch(/suppresses small numbers/);
    const uriarra = q(getHospitalContext(idx, { town: "Uriarra Village" }));
    expect(uriarra.measures.map((m: any) => m.status)).toEqual(["not_interpretable", "not_interpretable"]);
    expect(uriarra.measures[0].text).toMatch(/no data were assigned/);
  });

  it("interprets a hospital SR value without calling it a count", () => {
    const r = q(explainIndicator(idx, { indicator: "public_admissions", sr_value: 157 }));
    expect(r.interpretation).toContain("57% above the Australian level (100)");
    expect(r.interpretation).toMatch(/not a count of admissions/);
  });
});

describe("explain_indicator and dispatch", () => {
  it("explains a Census measure with its denominator and caveats", () => {
    const r = q(explainIndicator(idx, { indicator: "mental_health_pct" }));
    expect(r.denominatorIs).toBe("usual residents");
    expect(r.caveats.join(" ")).toMatch(/not age-standardised/i);
  });

  it("counts towns by remoteness", () => {
    const r = q(explainIndicator(idx, { indicator: "remoteness" }));
    expect(r.townsByRemoteness.reduce((n: number, x: any) => n + x.towns, 0)).toBe(1208);
  });

  it("links health and hospital layers like the site's own URLs", () => {
    const t = resolveTowns(idx, "Brewarrina").towns[0];
    expect(townLink(idx, t, "asthma_pct")).toBe("https://tinytownsatlas.github.io/?town=UCL121013&layer=asthma_pct");
    expect(townLink(idx, t, "pph")).toBe("https://tinytownsatlas.github.io/?town=UCL121013&layer=pph");
    expect(townLink(idx, t, "degree_pct")).toBe("https://tinytownsatlas.github.io/?town=UCL121013");
    expect(townLink(idx, null, "asthma_pct")).toBe("https://tinytownsatlas.github.io/?layer=asthma_pct");
  });

  it("returns an error object, never throws, for bad tool input", () => {
    expect(q(runTool(idx, "nope", {})).error).toBe("unknown_tool");
    expect(q(runTool(idx, "rank_towns", null)).error).toBeDefined();
    expect(q(runTool(idx, "get_town_profile", { town: 5 })).error).toBeDefined();
  });
});
