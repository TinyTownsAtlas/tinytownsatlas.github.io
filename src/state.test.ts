import { describe, expect, it } from "vitest";
import { DEFAULT_LAYER, DEFAULT_OUTCOME, parseState, stateToSearch } from "./state";

describe("URL state", () => {
  it("defaults to remoteness and diabetes with no params", () => {
    expect(parseState("")).toEqual({ selectedUclCode: null, layer: DEFAULT_LAYER, outcome: DEFAULT_OUTCOME });
    expect(stateToSearch(parseState(""))).toBe("");
  });

  it("round-trips a deep link to a town, layer and outcome", () => {
    const search = "?town=UCL121013&layer=cancer_pct&outcome=cancer_pct";
    const state = parseState(search);
    expect(state).toEqual({ selectedUclCode: "UCL121013", layer: "cancer_pct", outcome: "cancer_pct" });
    expect(stateToSearch(state)).toBe(search);
  });

  it("omits default values from the URL", () => {
    expect(stateToSearch({ selectedUclCode: "UCL322071", layer: DEFAULT_LAYER, outcome: DEFAULT_OUTCOME })).toBe(
      "?town=UCL322071",
    );
  });
});
