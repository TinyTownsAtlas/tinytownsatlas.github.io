# Tiny Towns Atlas

A small, elegant public visual atlas of Australian tiny towns (2021 ABS Urban Centres and
Localities with 100-1,499 usual residents): health and social context shown as a point within a
distribution, never a rank. See [`00_handoff/PROJECT_BRIEF.md`](../00_handoff/PROJECT_BRIEF.md)
for the full project brief and [`ARCHITECTURE.md`](ARCHITECTURE.md) /
[`DATA_CONTRACT.md`](DATA_CONTRACT.md) / [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for
how it's built.

The 100-resident lower bound is a Tiny Towns Atlas product definition, not an ABS definition of a
town. The published diabetes paper this Atlas builds on used 200 residents; the Atlas lowered the
bound in October 2026 to include communities of 100-199 residents. See `DATA_CONTRACT.md`.

## Run locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173.

## Production build

```bash
npm run build
```

Outputs a static site to `dist/`. Preview it with `npm run preview`.

## Rebuilding the data

The site's `public/data/*.json`/`*.geojson` files are static and committed to the repo; the
frontend never runs Python. To regenerate them after a source data change:

```bash
python -m pip install geopandas shapely pyogrio pandas openpyxl
python scripts/build_analytic.py   # PHIDU master workbook + ABS SA1 files -> 06_derived_data/census/atlas_ucl_dataset.csv
python scripts/build_geometry.py   # needs the ABS UCL 2021 GDA2020 shapefile, see the script's docstring
python scripts/build_data.py
python scripts/validate.py         # QA checks; exits non-zero on failure
```

## Sources and licensing

- Census data: ABS 2021 Census (TableBuilder), UCL extract supplied by PHIDU, Torrens University
  Australia (canonical master workbook in `05_source_archive/PHIDU_John_Glover/`). Attribute the ABS.
- Validation reference: Zenodo DOI [10.5281/zenodo.22783233](https://doi.org/10.5281/zenodo.22783233),
  CC BY 4.0 (Alexeev, Gwynne, Henson & Kirwan, 2026). For UCLs with 200+ residents the Atlas values
  reproduce this dataset exactly.
- Geometry: ABS ASGS Edition 3, Urban Centres and Localities 2021 (GDA2020), CC BY 4.0. Attribute
  the ABS.
- Basemap tiles: &copy; OpenStreetMap contributors, served from OSM's shared `tile.openstreetmap.org`.
  **This is a low-traffic-prototype choice, not a production one** — see the OSM
  [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) and
  `ARCHITECTURE.md`'s "Map strategy" section. Replace with a production-suitable tile provider
  before the site sees substantial public traffic.
- Site code: [MIT License](LICENSE). Does not cover the CC BY 4.0-licensed data/geometry above.

Full provenance detail is in `data/manifest.yml` and `public/data/manifest.json` (generated).

## Governance

This atlas deliberately does not produce rankings, performance scores, league tables, or named
residuals. See `DATA_CONTRACT.md` ("Fields that must never be treated as rankings") and
`../00_handoff/PROJECT_BRIEF.md` ("Governance constraints") before adding any new indicator or
view.
