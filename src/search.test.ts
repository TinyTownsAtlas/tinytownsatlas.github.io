import { describe, expect, it } from "vitest";
import { buildSearchIndex, search } from "./search";
import type { Town } from "./data";

function makeTown(code: string, name: string): Town {
  return {
    ucl_code: code,
    ucl_name: name,
    state_code: 1,
    state_name: "New South Wales",
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
    expect(search(index, "ten4ten")).toEqual([]);
  });

  it("matches a community alias without changing the town name", () => {
    const aliased = buildSearchIndex(towns, new Set(["UCL2"]), new Map([["UCL2", "King Island"]]));
    expect(search(aliased, "King Island").map((t) => t.ucl_name)).toEqual(["Berridale"]);
    expect(search(aliased, "island").map((t) => t.ucl_name)).toEqual(["Berridale"]);
    expect(search(aliased, "ba").map((t) => t.ucl_name)).toEqual(["Batlow", "Tumbarumba"]);
  });
});
