import { describe, expect, it } from "vitest";
import townJSON from "../public/data/towns.json?raw";
import indicatorJSON from "../public/data/indicators.json?raw";
import hospitalJSON from "../public/data/hospital_context.json?raw";
import manifestJSON from "../public/data/manifest.json?raw";
import type { AtlasData } from "./data";
import { getMapLayers, hospitalMapValues, sharedHospitalTowns } from "./layers";

const data = {
  towns: JSON.parse(townJSON), indicators: JSON.parse(indicatorJSON),
  hospital: JSON.parse(hospitalJSON), manifest: JSON.parse(manifestJSON),
} as AtlasData;

describe("generated data in the layer registry", () => {
  it("offers every opt-in Census health field and no descriptive context", () => {
    const layers = getMapLayers(data);
    expect(layers.filter((l) => l.kind === "sequential").map((l) => l.key)).toEqual(
      Object.values(data.indicators).filter((i) => i.category === "health" && i.mapLayer).map((i) => i.key),
    );
    expect(layers.filter((l) => l.kind === "sequential")).toHaveLength(10);
    for (const i of Object.values(data.indicators).filter((i) => i.category === "context")) {
      expect(layers.some((l) => l.key === i.key)).toBe(false);
    }
  });
  it("joins every hospital status as SR or null without allocated counts", () => {
    for (const town of data.towns) {
      const values = hospitalMapValues(data, town.ucl_code);
      expect(Object.keys(values)).toEqual(["public_admissions", "pph"]);
      for (const [key, value] of Object.entries(values)) {
        const source = data.hospital.towns[town.ucl_code].values[key];
        expect(value).toBe(source.status === "available" ? source.sr : null);
      }
    }
    expect(hospitalMapValues(data, "UCL822002")).toEqual({public_admissions:null, pph:null});
  });
  it("uses supplied PHA codes for actual Brewarrina peers and none for Currie", () => {
    expect(sharedHospitalTowns(data, "UCL121013", "public_admissions")).toHaveLength(4);
    expect(sharedHospitalTowns(data, "UCL621009", "public_admissions")).toEqual([]);
  });
});
