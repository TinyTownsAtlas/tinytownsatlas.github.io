import { describe, expect, it } from "vitest";
import { formatCount, formatPercent, formatPopulation } from "./format";

describe("format", () => {
  it("formats percent to one decimal by default", () => {
    expect(formatPercent(4.486)).toBe("4.5%");
  });

  it("formats percent to a given precision", () => {
    expect(formatPercent(4.486, 0)).toBe("4%");
  });

  it("formats population with thousands separators", () => {
    expect(formatPopulation(37511)).toBe("37,511");
  });

  it("formats counts rounded to whole numbers with separators", () => {
    expect(formatCount(1234.6)).toBe("1,235");
  });
});
