# IMPLEMENTATION PLAN

Small, testable steps. Each step should leave the repo in a working state.

## 0. Repo scaffold
- [x] `src/`, `public/data/`, `scripts/`, `data/`, `docs/`, `.github/workflows/` created.
- [x] `git init` locally (no remote, no push).
- [x] `.gitignore` (node_modules, dist, __pycache__, .venv, 03_working geometry download).
- [x] `package.json` + `vite` + `typescript` scaffold (`npm create vite@latest . -- --template vanilla-ts`
      equivalent, done by hand to keep control over structure).

## 1. Geometry build
- [x] Download ABS ASGS Ed3 UCL 2021 GDA2020 shapefile (done, in `03_working/geometry_raw/`,
      not committed — build-time input only, re-downloadable via documented URL).
- [x] `scripts/build_geometry.py`: load shapefile, join on `UCL` + `UCL_CODE21` == `ucl_code`,
      filter to the 1,743 analytic codes, compute representative point (WGS84), simplify polygon,
      write `public/data/towns.geojson`.
- [x] Validate: 1,743 matched, 0 unmatched, 0 duplicates, all geometries valid, file size reported.

## 2. Data build
- [x] `scripts/build_data.py`: read analytic CSV + codebook, compute `scope`, national/remoteness
      summary stats, join geometry (lon/lat) from step 1's output, write `public/data/towns.json`
      (primary scope, 1,148 rows) and `public/data/towns_full.json` (all 1,743, reference).
- [x] Write `public/data/indicators.json` per DATA_CONTRACT schema, including hand-written labels/
      descriptions/caveats for each indicator (health + context categories).
- [x] Write `public/data/manifest.json` (provenance).
- [x] `data/manifest.yml`: human-readable mirror of manifest.json for repo browsers.

## 3. QA / validate
- [x] `scripts/validate.py`: row counts (1148 primary / 1743 full), population scope bounds, unique
      UCL codes, expected indicator ranges (0-100 for all `*_pct`), remoteness group membership sums
      to primary total, every indicator has caveats+source, no nulls. Exit non-zero on failure.
- [x] Run once, fix any findings, keep as a repeatable `python scripts/validate.py` command.

## 4. Frontend shell
- [x] `index.html`, `src/main.ts`, base CSS, landing layout (title/subtitle/search/map container).
- [x] `src/data.ts`: typed fetch/parse of the four `public/data/*.json` files.
- [x] Map renders with MapLibre + CARTO basemap + `towns.geojson` points, colored by Remoteness Area
      (default layer). Verify in browser: all 1,148 points visible, Australia-shaped distribution.

## 5. Search + selection
- [x] `src/search.ts`: simple prefix/substring index over town names (+ state), built once from
      `towns.json` at load.
- [x] Search UI: input + results list, keyboard nav, click-to-select.
- [x] `src/state.ts`: URL state wiring (`?town=`, `?layer=`), `selectTown()` shared by search and
      map click.
- [x] Verify: selecting a town from search flies/centers map and opens panel; reload with `?town=`
      in URL opens directly to that town.

## 6. Town profile panel
- [x] `src/panel.ts`: desktop side panel / mobile bottom sheet, town/state/population/remoteness
      header, primary health indicator with numerator/denominator, People & context section
      (remaining indicators, consistent layout), About/interpretation drawer (collapsed by default).
- [x] Verify manually on a few towns per state/remoteness category.

## 7. Distribution charts
- [x] `src/charts.ts`: Observable Plot strip/rug function, parameterized by comparator subset +
      indicator; renders national strip and same-Remoteness-Area strip with median/IQR marks and
      the selected town highlighted, no axis rank labels.
- [x] Wire into panel: renders for the primary health indicator by default. An indicator picker to
      switch which indicator's distribution chart is shown was deferred past this MVP (not required
      by the brief's MVP scope, "Understand the town" already lists diabetes as the primary
      indicator); see final handoff for recommended next step.
- [x] Verify: selected marker position matches the town's actual value against a manual spot check.

## 8. Optional diabetes map layer
- [x] Layer toggle (Remoteness Area default <-> diabetes `circle-color` continuous scale using
      `indicators.json` domain). Toggle is an explicit, deliberate control (not default-on), per
      governance constraints.

## 9. Mobile pass
- [x] Resize/emulate mobile viewport, verify bottom sheet states, search reachability, chart
      legibility, tap targets.

## 10. Sources / attribution view
- [x] Small "About these data" page/panel section rendering `manifest.json` (DOI, licenses,
      attribution, scope definition, row counts) plus indicator caveats already in `indicators.json`.

## 11. GitHub Pages workflow (written, not run)
- [x] `.github/workflows/deploy.yml`: Node setup, `npm ci`, `npm run build`, upload+deploy Pages
      artifact, triggered on push to `main`. Not pushed/run per Git discipline.
- [x] `vite.config.ts` base path handling documented in ARCHITECTURE.md.

## 12. Final QA pass + handoff report
- [x] Re-run `scripts/validate.py`.
- [x] `npm run build` succeeds locally, `dist/` produced.
- [x] Manual desktop + mobile check across >=3 states and >=3 remoteness categories.
- [x] Write final handoff summary (what was built, run/build commands, blockers, decisions needing
      approval, recommended next step) back to the user.
