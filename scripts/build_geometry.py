"""Build public/data/towns.geojson from the ABS ASGS Edition 3 UCL 2021 shapefile.

Input (not committed, documented in DATA_CONTRACT.md):
  03_working/geometry_raw/UCL_2021_AUST_GDA2020_SHP/UCL_2021_AUST_GDA2020.shp
  Source: ABS "Urban Centres and Localities - 2021 - Shapefile" (GDA2020), ASGS Edition 3.
  https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/
  edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files

Output:
  public/data/towns.geojson           Point features (representative point) for every UCL present
                                       in the analytic CSV, in WGS84. This is what the MVP map
                                       loads at runtime, so it is kept lean (no polygon geometry).
  public/data/towns_polygons.geojson  Simplified polygon boundaries for the same UCLs, kept for a
                                       future close-zoom polygon layer. Not fetched by the MVP
                                       frontend.

Join key: analytic ucl_code (e.g. "UCL101001") == "UCL" + shapefile UCL_CODE21 (e.g. "101001").
"""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
SHAPEFILE = (
    ROOT
    / "03_working"
    / "geometry_raw"
    / "UCL_2021_AUST_GDA2020_SHP"
    / "UCL_2021_AUST_GDA2020.shp"
)
ANALYTIC_CSV = ROOT / "01_public_source" / "zenodo" / "diabetes_ucl_analytic_dataset.csv"
OUT_POINTS_PATH = ROOT / "04_site" / "public" / "data" / "towns.geojson"
OUT_POLYGONS_PATH = ROOT / "04_site" / "public" / "data" / "towns_polygons.geojson"

# Simplification tolerance in degrees (WGS84). ~0.001 deg is roughly 100m at Australian
# latitudes; adequate for national/state-zoom web display while keeping file size small.
SIMPLIFY_TOLERANCE_DEG = 0.001


def main() -> None:
    if not SHAPEFILE.exists():
        raise SystemExit(
            f"Shapefile not found at {SHAPEFILE}. Download the ABS UCL 2021 GDA2020 shapefile "
            "(see this script's docstring for the source URL) and unzip it there first."
        )

    gdf = gpd.read_file(SHAPEFILE)
    gdf["ucl_code"] = "UCL" + gdf["UCL_CODE21"].astype(str)

    analytic_codes = set(pd.read_csv(ANALYTIC_CSV, usecols=["ucl_code"])["ucl_code"])

    matched = gdf[gdf["ucl_code"].isin(analytic_codes)].copy()
    unmatched_analytic = analytic_codes - set(matched["ucl_code"])
    dupes = matched["ucl_code"][matched["ucl_code"].duplicated()].tolist()

    if unmatched_analytic:
        raise SystemExit(
            f"{len(unmatched_analytic)} analytic ucl_code(s) not found in shapefile: "
            f"{sorted(unmatched_analytic)[:10]}"
        )
    if dupes:
        raise SystemExit(f"Duplicate ucl_code(s) in matched geometry: {sorted(set(dupes))[:10]}")
    if len(matched) != len(analytic_codes):
        raise SystemExit(
            f"Matched {len(matched)} features but expected {len(analytic_codes)} analytic codes."
        )

    invalid = ~matched.geometry.is_valid
    if invalid.any():
        matched.loc[invalid, "geometry"] = matched.loc[invalid, "geometry"].buffer(0)

    # Representative point (guaranteed inside the polygon) computed in the source CRS (metric-ish
    # projected-equivalent behaviour is not required for representative_point, which works on any
    # CRS), then reprojected to WGS84 for MapLibre.
    matched["rep_point"] = matched.geometry.representative_point()

    wgs84 = matched.set_geometry("geometry").to_crs(4326)
    rep_wgs84 = gpd.GeoSeries(matched["rep_point"].values, crs=matched.crs).to_crs(4326)

    simplified = wgs84.geometry.simplify(SIMPLIFY_TOLERANCE_DEG, preserve_topology=True)

    point_features = []
    polygon_features = []
    for i, (_, row) in enumerate(wgs84.iterrows()):
        pt = rep_wgs84.iloc[i]
        props = {
            "ucl_code": row["ucl_code"],
            "ucl_name": row["UCL_NAME21"],
            "area_sqkm": round(float(row["AREASQKM21"]), 3),
        }
        point_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [pt.x, pt.y]},
                "properties": props,
            }
        )
        poly_geojson = json.loads(gpd.GeoSeries([simplified.iloc[i]], crs=4326).to_json())[
            "features"
        ][0]["geometry"]
        polygon_features.append(
            {"type": "Feature", "geometry": poly_geojson, "properties": {"ucl_code": row["ucl_code"]}}
        )

    OUT_POINTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_POINTS_PATH.write_text(
        json.dumps({"type": "FeatureCollection", "features": point_features}), encoding="utf-8"
    )
    OUT_POLYGONS_PATH.write_text(
        json.dumps({"type": "FeatureCollection", "features": polygon_features}), encoding="utf-8"
    )

    points_kb = OUT_POINTS_PATH.stat().st_size / 1024
    polygons_kb = OUT_POLYGONS_PATH.stat().st_size / 1024
    print(f"Wrote {len(point_features)} point features to {OUT_POINTS_PATH} ({points_kb:.0f} KB)")
    print(
        f"Wrote {len(polygon_features)} polygon features to {OUT_POLYGONS_PATH} ({polygons_kb:.0f} KB)"
    )


if __name__ == "__main__":
    main()
