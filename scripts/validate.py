"""QA checks over the built public/data/*.json. Exits non-zero on any failure."""

from __future__ import annotations

import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "public" / "data"

EXPECTED_PRIMARY_COUNT = 1148
EXPECTED_FULL_COUNT = 1743
PRIMARY_MIN_POP = 200
PRIMARY_MAX_POP = 1499
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

    # Row counts
    check(len(towns) == EXPECTED_PRIMARY_COUNT, f"towns.json has {len(towns)} rows, expected {EXPECTED_PRIMARY_COUNT}")
    check(len(towns_full) == EXPECTED_FULL_COUNT, f"towns_full.json has {len(towns_full)} rows, expected {EXPECTED_FULL_COUNT}")
    check(len(geo["features"]) == EXPECTED_FULL_COUNT, f"towns.geojson has {len(geo['features'])} features, expected {EXPECTED_FULL_COUNT}")

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
    check(sum(remoteness_counts.values()) == EXPECTED_PRIMARY_COUNT, "Remoteness group counts do not sum to primary total")

    # Indicator ranges + metadata completeness
    for key, meta in indicators.items():
        check(bool(meta.get("caveats")), f"Indicator {key} has no caveats")
        check(bool(meta.get("source")), f"Indicator {key} has no source")
        check(meta.get("isRankable") is False, f"Indicator {key} isRankable is not False")
        lo, hi = meta["domain"]
        check(0 <= lo <= 100 and 0 <= hi <= 100, f"Indicator {key} domain {meta['domain']} outside [0,100]")
        ns = meta["nationalStats"]
        check(ns["n"] == EXPECTED_PRIMARY_COUNT, f"Indicator {key} nationalStats.n={ns['n']}, expected {EXPECTED_PRIMARY_COUNT}")
        check(
            sum(rs["n"] for rs in meta["remotenessStats"].values()) == EXPECTED_PRIMARY_COUNT,
            f"Indicator {key} remotenessStats counts do not sum to {EXPECTED_PRIMARY_COUNT}",
        )

    for t in towns:
        for key in indicators:
            v = t[key]
            check(0 <= v <= 100, f"{t['ucl_code']} indicator {key}={v} outside [0,100]")

    # Manifest / provenance presence
    check(manifest.get("primaryCount") == EXPECTED_PRIMARY_COUNT, "manifest.primaryCount mismatch")
    check(manifest.get("referenceCount") == EXPECTED_FULL_COUNT, "manifest.referenceCount mismatch")
    check(len(manifest.get("sources", [])) >= 2, "manifest.sources should list both data sources")
    for src in manifest.get("sources", []):
        check(bool(src.get("license")), f"manifest source {src.get('name')} missing license")
        check(bool(src.get("attribution")), f"manifest source {src.get('name')} missing attribution")

    # Geometry join: every town has coordinates
    for t in towns:
        check("lon" in t and "lat" in t, f"{t['ucl_code']} missing lon/lat")
        check(-180 <= t["lon"] <= 180 and -90 <= t["lat"] <= 90, f"{t['ucl_code']} lon/lat out of range")

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
    return 0


if __name__ == "__main__":
    sys.exit(main())
