import { describe, expect, it } from "vitest";
import { buildSearchIndex, normalize, search, splitState } from "./search";
import type { Town } from "./data";

function makeTown(code: string, name: string, state = "New South Wales"): Town {
  return {
    ucl_code: code,
    ucl_name: name,
    state_code: 1,
    state_name: state,
    remoteness_code: 2,
    remoteness_name: "Inner Regional Australia",
    population: 500,
    scope: "primary",
    lon: 150,
    lat: -33,
  };
}

describe("search", () => {
  const towns = [
    makeTown("UCL1", "Batlow"),
    makeTown("UCL2", "Berridale"),
    makeTown("UCL3", "Tumbarumba"),
  ];
  const index = buildSearchIndex(towns);

  it("prioritizes prefix matches over substring matches", () => {
    const results = search(index, "ba");
    expect(results.map((t) => t.ucl_name)).toEqual(["Batlow", "Tumbarumba"]);
  });

  it("matches substrings not just prefixes", () => {
    const results = search(index, "dale");
    expect(results.map((t) => t.ucl_name)).toEqual(["Berridale"]);
  });

  it("is case-insensitive", () => {
    const results = search(index, "BATLOW");
    expect(results.map((t) => t.ucl_name)).toEqual(["Batlow"]);
  });

  it("returns empty for blank query", () => {
    expect(search(index, "   ")).toEqual([]);
  });

  it("returns nothing when no match", () => {
    expect(search(index, "zzz")).toEqual([]);
  });

  it("lists tagged Ten4Ten communities for a Ten4Ten query", () => {
    const tagged = buildSearchIndex(towns, new Set(["UCL3", "UCL1"]));
    expect(search(tagged, "Ten4Ten").map((t) => t.ucl_name)).toEqual(["Batlow", "Tumbarumba"]);
    expect(search(tagged, "ten 4 ten").map((t) => t.ucl_name)).toEqual(["Batlow", "Tumbarumba"]);
    expect(search(tagged, "Ten-4-Ten").map((t) => t.ucl_name)).toEqual(["Batlow", "Tumbarumba"]);
    expect(search(tagged, "ten four ten").map((t) => t.ucl_name)).toEqual(["Batlow", "Tumbarumba"]);
    expect(search(index, "ten4ten")).toEqual([]);
  });

  it("matches a community alias without changing the town name", () => {
    const aliased = buildSearchIndex(towns, new Set(["UCL2"]), new Map([["UCL2", "King Island"]]));
    expect(search(aliased, "King Island").map((t) => t.ucl_name)).toEqual(["Berridale"]);
    expect(search(aliased, "island").map((t) => t.ucl_name)).toEqual(["Berridale"]);
    expect(search(aliased, "ba").map((t) => t.ucl_name)).toEqual(["Batlow", "Tumbarumba"]);
  });
});

describe("search with state names and punctuation", () => {
  const towns = [
    makeTown("UCL322071", "Laura (L) (Qld)", "Queensland"),
    makeTown("UCL400001", "Laura", "South Australia"),
    makeTown("UCL121013", "Brewarrina (L)", "New South Wales"),
    makeTown("UCL621009", "Currie (L)", "Tasmania"),
    makeTown("UCL400002", "Port Victoria", "South Australia"),
    makeTown("UCL200001", "Portland", "Victoria"),
  ];
  const index = buildSearchIndex(towns, new Set(["UCL121013", "UCL621009"]), new Map([["UCL621009", "King Island"]]));
  const names = (q: string) => search(index, q).map((t) => t.ucl_name);

  it("finds Laura (Qld) by name alone", () => {
    expect(names("Laura")).toEqual(["Laura", "Laura (L) (Qld)"]);
  });

  it("finds Laura (Qld) with a full state name", () => {
    expect(names("Laura Queensland")).toEqual(["Laura (L) (Qld)"]);
  });

  it("finds Laura (Qld) with a state abbreviation, in any case or punctuation", () => {
    expect(names("Laura Qld")).toEqual(["Laura (L) (Qld)"]);
    expect(names("laura, QLD")).toEqual(["Laura (L) (Qld)"]);
    expect(names("Laura (Qld)")).toEqual(["Laura (L) (Qld)"]);
  });

  it("restricts to the named state", () => {
    expect(names("Laura SA")).toEqual(["Laura"]);
    expect(names("Laura South Australia")).toEqual(["Laura"]);
    expect(names("Laura Victoria")).toEqual([]);
  });

  it("accepts a leading state", () => {
    expect(names("NSW Brewarrina")).toEqual(["Brewarrina (L)"]);
  });

  it("keeps place names that contain a state word", () => {
    expect(names("Port Victoria")).toEqual(["Port Victoria"]);
  });

  it("keeps King Island -> Currie with or without a state", () => {
    expect(names("King Island")).toEqual(["Currie (L)"]);
    expect(names("King Island Tas")).toEqual(["Currie (L)"]);
    expect(names("Currie Tasmania")).toEqual(["Currie (L)"]);
  });

  it("does not list a whole state for a bare state name", () => {
    expect(names("Queensland")).toEqual([]);
    // "(Qld)" is part of this UCL's own name, so it matches as ordinary name text.
    expect(names("qld")).toEqual(["Laura (L) (Qld)"]);
  });
});

describe("normalize / splitState", () => {
  it("normalizes punctuation, case and diacritics", () => {
    expect(normalize("  Laura (L) (Qld) ")).toBe("laura l qld");
    expect(normalize("Mt. Évelyn")).toBe("mt evelyn");
  });

  it("prefers the longest state phrase", () => {
    expect(splitState("laura south australia")).toEqual({ place: "laura", state: "south australia" });
    expect(splitState("laura sa")).toEqual({ place: "laura", state: "south australia" });
    expect(splitState("laura")).toBeNull();
  });
});
