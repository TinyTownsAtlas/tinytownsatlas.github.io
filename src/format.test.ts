import { describe, expect, it } from "vitest";
import { describeStandardisedRatio, formatCount, formatPercent, formatPopulation } from "./format";

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

  it("describes a standardised ratio against Australia = 100", () => {
    expect(describeStandardisedRatio(156.6)).toBe("about 1.6 times the Australian rate, allowing for age");
    expect(describeStandardisedRatio(83.8)).toBe("about 0.8 times the Australian rate, allowing for age");
    expect(describeStandardisedRatio(102.9)).toBe("about the same as the Australian rate, allowing for age");
  });
});
