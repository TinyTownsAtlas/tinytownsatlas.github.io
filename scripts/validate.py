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

    for t in towns:
        for key in indicators:
            v = t[key]
            check(0 <= v <= 100, f"{t['ucl_code']} indicator {key}={v} outside [0,100]")

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
