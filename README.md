# Tiny Towns Atlas

A small, elegant public visual atlas of Australian tiny towns (2021 ABS Urban Centres and
Localities with 100-1,499 usual residents): health and social context shown as a point within a
distribution, never a rank. See [`00_handoff/PROJECT_BRIEF.md`](../00_handoff/PROJECT_BRIEF.md)
for the full project brief and [`ARCHITECTURE.md`](ARCHITECTURE.md) /
[`DATA_CONTRACT.md`](DATA_CONTRACT.md) / [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for
how it's built.

The default **All towns** map shows 1,208 towns in one neutral colour. Point area represents
population on **every** layer (100–1,499 usual residents); the map control states this scope and a
compact size legend shows 100, 500, 1,000 and 1,499 residents. Colour represents the chosen measure.
The native grouped picker offers ten Census long-term conditions: Diabetes, Cancer, Asthma,
Arthritis, Mental health, Heart disease, Lung condition, Kidney disease, Stroke and Dementia.
Full ABS definitions, numerators/denominators, national and same-remoteness distributions and
interpretation notes remain in the panel. These are Census reports, not clinical prevalence or
age-standardised measures. Remoteness (ABS) is optional under Geography: geographic accessibility,
not town population.

Hospital admissions (2022/23, excluding same-day dialysis) and Preventable hospitalisations
(2020/21) are separate **PHA-derived broader-area** map layers, using indirectly age-standardised
ratios (Australia = 100), never allocated town counts. A blue–neutral–brown log-ratio scale has
stops at 50, 100 and 200; colours saturate outside those endpoints and the legend says so. Missing
and suppressed values stay neutral. Selecting either hospital layer surfaces hospital context
immediately below the town header. Only peers with the same supplied PHA code and an available
selected measure receive an outline; no inferred area boundaries or PHA names. Hospital data keep
their separate PHIDU CC BY-NC-SA licence and have no town comparison distributions.
Unemployment remains unemployed / labour force, matching Census QuickStats for the same UCL.

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
python scripts/build_phidu_context.py  # PHIDU hospital workbook + PHA flags -> 06_derived_data/phidu_context/
python scripts/build_geometry.py   # needs the ABS UCL 2021 GDA2020 shapefile, see the script's docstring
python scripts/build_data.py
python scripts/validate.py         # QA checks; exits non-zero on failure
python -m unittest discover -s scripts -p "test_*.py"  # source/header and output regression tests
npm test                           # unit tests (search, layers/legend, URL state, formatting)
```

`build_analytic.py` fails unless its 200+ subset reproduces the published Zenodo dataset exactly;
`validate.py` also checks Brewarrina (UCL121013) against ABS QuickStats values.

To add another Census health outcome: add its workbook columns to `INDICATOR_COLUMNS` in
`build_analytic.py` (with header labels), add metadata with `category: "health"` and
`mapLayer: True` in `scripts/indicator_defs.py`, and rebuild. Verify the full category wording in the ABS Census dictionary and add independent
source anchors/tests. The panel selector, map layer
picker and legend are generated from `indicators.json`; no frontend changes are needed.

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
- Hospital services context (`public/data/hospital_context.json` only): derived from estimates by
  the Public Health Information Development Unit (PHIDU), Torrens University Australia, licensed
  [CC BY-NC-SA 3.0 AU](https://creativecommons.org/licenses/by-nc-sa/3.0/au/). This licence
  applies to that file, not to the rest of the Atlas.
- Site code: [MIT License](LICENSE). Does not cover the CC BY 4.0-licensed data/geometry above.

Full provenance detail is in `data/manifest.yml` and `public/data/manifest.json` (generated).

## Governance

This atlas deliberately does not produce rankings, performance scores, league tables, or named
residuals. See `DATA_CONTRACT.md` ("Fields that must never be treated as rankings") and
`../00_handoff/PROJECT_BRIEF.md` ("Governance constraints") before adding any new indicator or
view.

## Local build troubleshooting

If Dropbox prevents Vite from clearing `dist/assets`, use
`npm run build -- --emptyOutDir false`; Vite emits a new hashed bundle and updates `dist/index.html`
without deleting locked directories. This flag is a local workaround, not a deployment change.
