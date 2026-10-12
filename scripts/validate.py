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
REQUIRED_HEALTH_INDICATORS = {"diabetes_pct", "cancer_pct"}
# Context-only: may never become a map colour layer or a health outcome.
CONTEXT_ONLY_INDICATORS = {"indigenous_pct"}
# Replaced in the display by unemployment_rate_pct (unemployed / labour force); must not return
# as a displayed indicator.
RETIRED_DISPLAY_INDICATORS = {"unemployed_residents_pct"}

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
