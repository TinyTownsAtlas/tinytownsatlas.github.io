"""QA checks over the built public/data/*.json. Exits non-zero on any failure."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "public" / "data"

# Atlas product scope (the published diabetes paper used a 200 lower bound; see build_analytic.py).
PRIMARY_MIN_POP = 100
PRIMARY_MAX_POP = 1499
# Regression anchors from the published Zenodo dataset (population >= 200). Expanding the lower
# bound must leave these subsets unchanged.
PUBLISHED_REFERENCE_COUNT = 1743
PUBLISHED_PRIMARY_200_COUNT = 1148
SPECIAL_NAME = re.compile(r"Remainder|Migratory|No usual address", re.IGNORECASE)
REMOTENESS_NAMES = {
    "Major Cities of Australia",
    "Inner Regional Australia",
    "Outer Regional Australia",
    "Remote Australia",
    "Very Remote Australia",
}

# Town-level anchors checked independently against ABS 2021 Census QuickStats for the same UCL
# (https://www.abs.gov.au/census/find-census-data/quickstats/2021/UCL121013, checked 13 October
# 2026). Brewarrina (L): diabetes 52 (7.0%), cancer (including remission) 13 (1.7%), unemployed 13
# of 254 in the labour force (5.1%). The 7.1% unemployment figure sometimes quoted for Brewarrina
# is the Local Government Area (LGA11200: 34 of 481), a wider geography.
QUICKSTATS_ANCHORS = {
    "UCL121013": {
        "diabetes": (52, 743, 7.0),
        "cancer": (13, 743, 1.7),
        "unemployment_rate": (13, 254, 5.1),
    },
}
REQUIRED_HEALTH_INDICATORS = {f"{stem}_pct" for stem in ("diabetes", "cancer", "asthma", "arthritis", "mental_health", "heart_disease", "lung_condition", "kidney_disease", "stroke", "dementia")}
# Context-only: may never become a map colour layer or a health outcome.
CONTEXT_ONLY_INDICATORS = {"indigenous_pct"}
# Replaced in the display by unemployment_rate_pct (unemployed / labour force); must not return
# as a displayed indicator.
RETIRED_DISPLAY_INDICATORS = {"unemployed_residents_pct"}

# PHIDU Hospital_data_workbook.xlsx (Data sheet, SR columns 4 and 23) and master-workbook PHA
# flags, read directly from the archived originals: (PHA code, public admissions SR, PPH SR).
HOSPITAL_ANCHORS = {
    "UCL121013": ("10193", 156.6, 227.7),  # Brewarrina (L): Bourke - Brewarrina/ Walgett - Lightning Ridge
    "UCL322071": ("30183", 188.1, 346.1),  # Laura (L) (Qld): Far North (Qld)
    "UCL621009": (None, 105.9, 83.8),  # Currie (L): not in PHIDU's split list; no PHA identified
}
HOSPITAL_STATUSES = {"available", "suppressed", "not_available", "not_interpretable"}

errors: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    towns = json.loads((DATA_DIR / "towns.json").read_text(encoding="utf-8"))
    towns_full = json.loads((DATA_DIR / "towns_full.json").read_text(encoding="utf-8"))
    indicators = json.loads((DATA_DIR / "indicators.json").read_text(encoding="utf-8"))
    manifest = json.loads((DATA_DIR / "manifest.json").read_text(encoding="utf-8"))
    geo = json.loads((DATA_DIR / "towns.geojson").read_text(encoding="utf-8"))

    # Row counts: derived from the full settlement dataset, not hard-coded
    expected_primary = sum(PRIMARY_MIN_POP <= t["population"] <= PRIMARY_MAX_POP for t in towns_full)
    expected_full = len(towns_full)
    check(len(towns) == expected_primary, f"towns.json has {len(towns)} rows, expected {expected_primary}")
    check(len(geo["features"]) == expected_full, f"towns.geojson has {len(geo['features'])} features, expected {expected_full}")
    check(min(t["population"] for t in towns_full) >= PRIMARY_MIN_POP, "towns_full.json contains a UCL below the lower bound")
    for t in towns_full:
        check(not SPECIAL_NAME.search(t["ucl_name"]), f"{t['ucl_code']} {t['ucl_name']!r} is a special/non-settlement record")
    check(
        sum(t["population"] >= 200 for t in towns_full) == PUBLISHED_REFERENCE_COUNT,
        f"UCLs with 200+ residents != published {PUBLISHED_REFERENCE_COUNT}",
    )
    check(
        sum(t["population"] >= 200 for t in towns) == PUBLISHED_PRIMARY_200_COUNT,
        f"Primary UCLs with 200+ residents != published {PUBLISHED_PRIMARY_200_COUNT}",
    )

    # Unique UCL codes
    codes = [t["ucl_code"] for t in towns]
    check(len(codes) == len(set(codes)), "Duplicate ucl_code in towns.json")
    codes_full = [t["ucl_code"] for t in towns_full]
    check(len(codes_full) == len(set(codes_full)), "Duplicate ucl_code in towns_full.json")

    # Population scope
    for t in towns:
        check(
            PRIMARY_MIN_POP <= t["population"] <= PRIMARY_MAX_POP,
            f"{t['ucl_code']} population {t['population']} outside primary scope [{PRIMARY_MIN_POP},{PRIMARY_MAX_POP}]",
        )
        check(t["scope"] == "primary", f"{t['ucl_code']} in towns.json has scope={t['scope']!r}, expected 'primary'")

    # Remoteness membership sums to primary total
    remoteness_counts: dict[str, int] = {}
    for t in towns:
        check(t["remoteness_name"] in REMOTENESS_NAMES, f"{t['ucl_code']} has unexpected remoteness_name {t['remoteness_name']!r}")
        remoteness_counts[t["remoteness_name"]] = remoteness_counts.get(t["remoteness_name"], 0) + 1
    check(sum(remoteness_counts.values()) == expected_primary, "Remoteness group counts do not sum to primary total")

    # Indicator ranges + metadata completeness
    for key, meta in indicators.items():
        check(bool(meta.get("caveats")), f"Indicator {key} has no caveats")
        check(bool(meta.get("source")), f"Indicator {key} has no source")
        check(meta.get("isRankable") is False, f"Indicator {key} isRankable is not False")
        lo, hi = meta["domain"]
        check(0 <= lo <= 100 and 0 <= hi <= 100, f"Indicator {key} domain {meta['domain']} outside [0,100]")
        ns = meta["nationalStats"]
        check(ns["n"] == expected_primary, f"Indicator {key} nationalStats.n={ns['n']}, expected {expected_primary}")
        check(
            sum(rs["n"] for rs in meta["remotenessStats"].values()) == expected_primary,
            f"Indicator {key} remotenessStats counts do not sum to {expected_primary}",
        )

        check(bool(meta.get("definition")), f"Indicator {key} has no definition")
        check(meta["category"] in ("health", "context"), f"Indicator {key} has unknown category {meta['category']!r}")
        check(
            not meta.get("mapLayer") or meta["category"] == "health",
            f"Indicator {key} is a map layer but not a health indicator",
        )
        check(meta.get("isDefaultMapLayer") is False, f"Indicator {key} must not be the default map layer")

    check({k for k, m in indicators.items() if m["category"] == "health"} == REQUIRED_HEALTH_INDICATORS, "Health indicators must be exactly the ten Census LTHP conditions")
    check(manifest.get("defaultMapLayer") == "all_towns", "Default must be All towns")
    for key in REQUIRED_HEALTH_INDICATORS:
        check(key in indicators and indicators[key]["category"] == "health", f"Missing health indicator {key}")
    for key in CONTEXT_ONLY_INDICATORS:
        meta = indicators.get(key, {})
        check(meta.get("category") == "context" and not meta.get("mapLayer"), f"{key} must stay context-only")
    for key in RETIRED_DISPLAY_INDICATORS:
        check(key not in indicators, f"{key} (unemployed / all residents) must not be displayed")
    unemployment = indicators.get("unemployment_rate_pct", {})
    check(
        unemployment.get("denominatorField") == "unemployment_rate_denominator"
        and "labour force" in unemployment.get("denominatorLabel", ""),
        "unemployment_rate_pct must use the labour force denominator",
    )

    for t in towns:
        for key in indicators:
            v = t[key]
            check(0 <= v <= 100, f"{t['ucl_code']} indicator {key}={v} outside [0,100]")

    towns_by_code = {t["ucl_code"]: t for t in towns}
    for code, anchors in QUICKSTATS_ANCHORS.items():
        t = towns_by_code.get(code)
        check(t is not None, f"Anchor town {code} missing from towns.json")
        if t is None:
            continue
        for stem, (num, den, pct) in anchors.items():
            got = (t.get(f"{stem}_count"), t.get(f"{stem}_denominator"), t.get(f"{stem}_pct"))
            check(got == (num, den, pct), f"{code} {stem}: {got} != ABS QuickStats {(num, den, pct)}")

    # Recompute the complete distributions and ratios, rather than checking only group counts.
    import pandas as pd
    from build_data import compute_stats
    from build_data import ANALYTIC_CSV
    analytic = pd.read_csv(ANALYTIC_CSV)
    frame = analytic[analytic["ucl_code"].isin(codes)]
    for key in REQUIRED_HEALTH_INDICATORS:
        meta = indicators[key]
        check(meta.get("mapLayer") is True, f"{key} must be opt-in map layer")
        check(any("age-standardised" in c for c in meta["caveats"]), f"{key} lacks age caveat")
        check(meta["nationalStats"] == compute_stats(frame[key]), f"{key} national distribution differs")
        for name, group in frame.groupby("remoteness_name"):
            check(meta["remotenessStats"][name] == compute_stats(group[key]), f"{key} {name} distribution differs")
        for town in towns_full:
            num, den = town[meta["numeratorField"]], town[meta["denominatorField"]]
            check(0 <= num <= den and den == town["population"], f"{town['ucl_code']} {key} invalid numerator/denominator")
            check(town[key] == round(100 * num / den, meta["precision"]), f"{town['ucl_code']} {key} ratio mismatch")

    # Manifest / provenance presence
    check(manifest.get("primaryCount") == expected_primary, "manifest.primaryCount mismatch")
    check(manifest.get("primaryMinPopulation") == PRIMARY_MIN_POP, "manifest.primaryMinPopulation mismatch")
    check(manifest.get("primaryMaxPopulation") == PRIMARY_MAX_POP, "manifest.primaryMaxPopulation mismatch")
    check(f"{PRIMARY_MIN_POP}-" in manifest.get("scopeDefinition", ""), "manifest.scopeDefinition does not state the lower bound")
    check(manifest.get("referenceCount") == expected_full, "manifest.referenceCount mismatch")
    check(len(manifest.get("sources", [])) >= 3, "manifest.sources should list Census extract, validation reference and geometry")
    for src in manifest.get("sources", []):
        check(bool(src.get("license")), f"manifest source {src.get('name')} missing license")
        check(bool(src.get("attribution")), f"manifest source {src.get('name')} missing attribution")

    # Geometry join: every town has coordinates
    for t in towns:
        check("lon" in t and "lat" in t, f"{t['ucl_code']} missing lon/lat")
        check(-180 <= t["lon"] <= 180 and -90 <= t["lat"] <= 90, f"{t['ucl_code']} lon/lat out of range")

    # Ten4Ten tags: display-only, every tagged town is an existing primary-scope town
    ten4ten = json.loads((DATA_DIR / "ten4ten.json").read_text(encoding="utf-8"))
    tag_codes = ten4ten.get("uclCodes", [])
    check(bool(ten4ten.get("label")), "ten4ten.json missing label")
    check(len(tag_codes) == len(set(tag_codes)), "Duplicate ucl_code in ten4ten.json")
    primary_codes = set(codes)
    for code in tag_codes:
        check(code in primary_codes, f"ten4ten.json tags {code}, which is not a primary-scope town")
    for code, label in ten4ten.get("communityLabels", {}).items():
        check(code in tag_codes, f"ten4ten.json community label for untagged town {code}")
        check(bool(label.strip()), f"ten4ten.json empty community label for {code}")

    # Hospital-services context (PHIDU, PHA-derived): separate file, separate licence, never a
    # town distribution; SR-only map layers never read allocated counts.
    hospital = json.loads((DATA_DIR / "hospital_context.json").read_text(encoding="utf-8"))
    licence = hospital.get("licence", {})
    check(licence.get("name") == "CC BY-NC-SA 3.0 AU", "hospital_context.json licence must be CC BY-NC-SA 3.0 AU")
    check(licence.get("url", "").startswith("https://creativecommons.org/licenses/by-nc-sa/3.0/au"), "hospital_context.json licence URL")
    check("PHIDU" in licence.get("attribution", ""), "hospital_context.json must attribute PHIDU")
    check(bool(hospital.get("caveats")), "hospital_context.json has no caveats")
    check(set(hospital.get("towns", {})) == set(codes), "hospital_context.json towns differ from primary towns")
    hospital_keys = set(hospital.get("indicators", {}))
    check(hospital_keys == {"public_admissions", "pph"}, f"hospital_context.json indicators {sorted(hospital_keys)}")
    check(not hospital_keys & {k.removesuffix("_pct") for k in indicators}, "hospital indicators must not be in indicators.json")
    sr_by_pha: dict[tuple[str, str], set[float]] = {}
    for code, entry in hospital.get("towns", {}).items():
        check(set(entry) == {"phaCode", "phaName", "sharedUclCount", "values"}, f"{code} hospital fields {sorted(entry)}")
        check(bool(entry["phaCode"]) == bool(entry["phaName"]), f"{code} PHA code/name mismatch")
        for key in hospital_keys:
            value = entry["values"][key]
            check(set(value) == {"status", "sr"}, f"{code} {key} must carry only status and sr (no allocated counts)")
            check(value["status"] in HOSPITAL_STATUSES, f"{code} {key} status {value['status']!r}")
            if value["status"] == "available":
                check(isinstance(value["sr"], (int, float)) and value["sr"] > 0, f"{code} {key} available but sr={value['sr']!r}")
            else:
                check(value["sr"] is None, f"{code} {key} is {value['status']} but has sr={value['sr']!r}")
            if entry["phaCode"] and value["status"] == "available":
                sr_by_pha.setdefault((entry["phaCode"], key), set()).add(value["sr"])
    for (pha_code, key), values in sr_by_pha.items():
        check(len(values) == 1, f"PHA {pha_code} {key}: towns from one PHA carry different ratios {sorted(values)}")
    for code, (pha_code, admissions, pph) in HOSPITAL_ANCHORS.items():
        entry = hospital.get("towns", {}).get(code)
        check(entry is not None, f"Hospital anchor {code} missing")
        if entry:
            got = (entry["phaCode"], entry["values"]["public_admissions"]["sr"], entry["values"]["pph"]["sr"])
            check(got == (pha_code, admissions, pph), f"{code} hospital context {got} != source {(pha_code, admissions, pph)}")

    if errors:
        print(f"VALIDATION FAILED: {len(errors)} error(s)")
        for e in errors[:50]:
            print(f"  - {e}")
        return 1

    print("All validation checks passed.")
    print(f"  primary towns: {len(towns)}")
    print(f"  reference towns: {len(towns_full)}")
    print(f"  indicators: {len(indicators)}")
    print(f"  remoteness groups: {remoteness_counts}")
    print(f"  Ten4Ten tagged towns: {len(tag_codes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
