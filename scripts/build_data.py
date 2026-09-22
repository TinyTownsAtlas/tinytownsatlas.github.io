"""Build public/data/towns.json, towns_full.json, indicators.json, manifest.json.

Reads the canonical Zenodo analytic CSV (unmodified) and the town point geometry produced by
build_geometry.py, and writes the static JSON the frontend fetches at runtime.

Run build_geometry.py first.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from indicator_defs import DEFAULT_MAP_LAYER, INDICATORS

ROOT = Path(__file__).resolve().parents[2]
ANALYTIC_CSV = ROOT / "01_public_source" / "zenodo" / "diabetes_ucl_analytic_dataset.csv"
GEOJSON_POINTS = ROOT / "04_site" / "public" / "data" / "towns.geojson"
DATA_DIR = ROOT / "04_site" / "public" / "data"

PRIMARY_MIN_POP = 200
PRIMARY_MAX_POP = 1499
PRECISION = 1

REMOTENESS_ORDER = [
    "Major Cities of Australia",
    "Inner Regional Australia",
    "Outer Regional Australia",
    "Remote Australia",
    "Very Remote Australia",
]


def round_stat(value: float) -> float:
    return round(float(value), PRECISION)


def compute_stats(series: pd.Series) -> dict:
    return {
        "median": round_stat(series.median()),
        "q1": round_stat(series.quantile(0.25)),
        "q3": round_stat(series.quantile(0.75)),
        "p10": round_stat(series.quantile(0.10)),
        "p90": round_stat(series.quantile(0.90)),
        "n": int(series.count()),
    }


def main() -> None:
    df = pd.read_csv(ANALYTIC_CSV)

    if df.isnull().any().any():
        bad_cols = df.columns[df.isnull().any()].tolist()
        raise SystemExit(f"Unexpected missing values in columns: {bad_cols}")

    df["scope"] = df["population"].apply(
        lambda p: "primary" if PRIMARY_MIN_POP <= p <= PRIMARY_MAX_POP else "reference_only"
    )

    geo = json.loads(GEOJSON_POINTS.read_text(encoding="utf-8"))
    geo_by_code = {
        f["properties"]["ucl_code"]: f["geometry"]["coordinates"] for f in geo["features"]
    }
    missing_geo = set(df["ucl_code"]) - set(geo_by_code)
    if missing_geo:
        raise SystemExit(f"{len(missing_geo)} ucl_code(s) missing geometry: {sorted(missing_geo)[:10]}")

    df["lon"] = df["ucl_code"].map(lambda c: geo_by_code[c][0])
    df["lat"] = df["ucl_code"].map(lambda c: geo_by_code[c][1])

    primary = df[df["scope"] == "primary"].copy()

    # --- indicators.json: metadata + precomputed distribution stats over PRIMARY scope only ---
    indicators_out = {}
    for key, meta in INDICATORS.items():
        pct_col = key
        num_col = key.replace("_pct", "_count")
        den_col = key.replace("_pct", "_denominator")
        if pct_col not in primary.columns:
            raise SystemExit(f"Indicator column not found in analytic CSV: {pct_col}")

        national_stats = compute_stats(primary[pct_col])
        remoteness_stats = {
            rname: compute_stats(group[pct_col])
            for rname, group in primary.groupby("remoteness_name")
            if len(group) > 0
        }

        indicators_out[key] = {
            "key": key,
            "label": meta["label"],
            "shortLabel": meta["shortLabel"],
            "unit": "percent",
            "precision": PRECISION,
            "numeratorField": num_col,
            "denominatorField": den_col,
            "denominatorLabel": meta["denominatorLabel"],
            "category": meta["category"],
            "isDefaultMapLayer": meta["isDefaultMapLayer"],
            "isRankable": False,
            "colorScale": meta["colorScale"],
            "domain": [round_stat(primary[pct_col].min()), round_stat(primary[pct_col].max())],
            "description": meta["description"],
            "caveats": meta["caveats"],
            "source": meta["source"],
            "nationalStats": national_stats,
            "remotenessStats": remoteness_stats,
        }

        if not meta["caveats"] or not meta["source"]:
            raise SystemExit(f"Indicator {key} missing caveats or source")

    (DATA_DIR / "indicators.json").write_text(
        json.dumps(indicators_out, indent=None, separators=(",", ":")), encoding="utf-8"
    )

    # --- towns.json (primary scope, 1,148 rows) and towns_full.json (all 1,743) ---
    keep_cols = [
        "ucl_code",
        "ucl_name",
        "state_code",
        "state_name",
        "remoteness_code",
        "remoteness_name",
        "population",
        "scope",
        "lon",
        "lat",
    ] + [c for k in INDICATORS for c in (k, k.replace("_pct", "_count"), k.replace("_pct", "_denominator"))]

    def rows_to_json(frame: pd.DataFrame) -> list[dict]:
        out = []
        for _, row in frame.iterrows():
            rec = {c: row[c] for c in keep_cols}
            for k in INDICATORS:
                rec[k] = round_stat(rec[k])
            rec["population"] = int(rec["population"])
            out.append(rec)
        return out

    towns_primary = rows_to_json(primary[keep_cols])
    towns_full = rows_to_json(df[keep_cols])

    (DATA_DIR / "towns.json").write_text(
        json.dumps(towns_primary, separators=(",", ":")), encoding="utf-8"
    )
    (DATA_DIR / "towns_full.json").write_text(
        json.dumps(towns_full, separators=(",", ":")), encoding="utf-8"
    )

    # --- manifest.json ---
    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sources": [
            {
                "name": "Diabetology UCL analytic dataset",
                "doi": "10.5281/zenodo.22783233",
                "license": "CC BY 4.0",
                "attribution": "Alexeev, Gwynne, Henson & Kirwan (2026); Australian Bureau of Statistics",
                "rowCount": int(len(df)),
            },
            {
                "name": "ABS ASGS Edition 3 - Urban Centres and Localities 2021 (GDA2020 shapefile)",
                "license": "CC BY 4.0",
                "attribution": "Australian Bureau of Statistics",
                "matchedCount": int(len(df)),
            },
        ],
        "scopeDefinition": (
            f"Primary display universe: UCL population {PRIMARY_MIN_POP}-{PRIMARY_MAX_POP} "
            "(analytical choice from the Diabetology work, not an official ABS definition of a town)."
        ),
        "primaryCount": int(len(primary)),
        "referenceCount": int(len(df)),
        "defaultMapLayer": DEFAULT_MAP_LAYER,
        "remotenessOrder": REMOTENESS_ORDER,
    }
    (DATA_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"towns.json: {len(towns_primary)} rows")
    print(f"towns_full.json: {len(towns_full)} rows")
    print(f"indicators.json: {len(indicators_out)} indicators")
    print("manifest.json written")


if __name__ == "__main__":
    main()
