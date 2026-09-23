# Tiny Towns Atlas

A small, elegant public visual atlas of Australian tiny towns (2021 ABS Urban Centres and
Localities, population 200-1,499): health and social context shown as a point within a
distribution, never a rank. See [`00_handoff/PROJECT_BRIEF.md`](../00_handoff/PROJECT_BRIEF.md)
for the full project brief and [`ARCHITECTURE.md`](ARCHITECTURE.md) /
[`DATA_CONTRACT.md`](DATA_CONTRACT.md) / [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for
how it's built.

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
python -m pip install geopandas shapely pyogrio pandas
python scripts/build_geometry.py   # needs the ABS UCL 2021 GDA2020 shapefile, see the script's docstring
python scripts/build_data.py
python scripts/validate.py         # QA checks; exits non-zero on failure
```

## Sources and licensing

- Analytic dataset: Zenodo DOI [10.5281/zenodo.22783233](https://doi.org/10.5281/zenodo.22783233),
  CC BY 4.0. Attribute Alexeev, Gwynne, Henson & Kirwan (2026) and the ABS.
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
