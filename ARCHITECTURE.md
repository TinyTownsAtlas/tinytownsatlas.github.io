# ARCHITECTURE

Static, client-only site. No backend, no database, no runtime Python.

## App structure

```
04_site/
  src/
    main.ts              entry point, app shell, router/state wiring
    state.ts              URL <-> app state (selected town, layer, panel open)
    search.ts              client-side fuzzy/prefix search over town index
    map.ts                 MapLibre setup, layers, click/hover handlers
    charts.ts               Observable Plot distribution strips
    panel.ts                town profile panel (desktop side panel / mobile sheet)
    data.ts                 typed loaders for public/data/*.json, indicator metadata
    format.ts               number/percent formatting, precision rules
    style/                  CSS (plain CSS, no framework)
  public/
    data/
      towns.json            1,148-row town index (MVP display universe)
      towns_full.json       1,743-row reference dataset (comparators, distributions)
      towns.geojson         point + simplified polygon geometry for the 1,148 towns
      indicators.json       indicator metadata (labels, units, precision, caveats, "never rank" flags)
      manifest.json         provenance: source DOI, ABS product versions, build date, row counts
  scripts/                  Python build-time scripts (not shipped to the browser)
    fetch_geometry.py       (manual/documented step: uses already-downloaded ABS shapefile)
    build_data.py           analytic CSV -> public/data/towns.json, towns_full.json, indicators.json
    build_geometry.py       ABS shapefile -> public/data/towns.geojson (filtered, simplified, joined)
    validate.py             QA checks (Phase-3 "QA" section of the build prompt)
  data/
    manifest.yml            human-readable source manifest (DOI, file hashes, ABS product IDs)
  docs/                     this file + DATA_CONTRACT.md + IMPLEMENTATION_PLAN.md (copied/kept in sync)
  .github/workflows/
    deploy.yml               GitHub Pages build+deploy (not run until explicitly instructed)
```

No framework (no React/Vue/Svelte). Vanilla TypeScript modules, native `<template>`/DOM APIs for
the panel and search results. The UI surface is small enough (map, search box, one panel, a few
charts) that a component framework would add build complexity without a corresponding benefit, and
the brief explicitly asks to avoid React unless concretely needed.

## Map strategy

- **MapLibre GL JS**, vector/raster basemap via a free, keyless tile source (raster OpenStreetMap
  standard tiles — no token, no paid service, consistent with "avoid paid map services"). Only the basemap
  tiles are remote at runtime; all town data is local static JSON/GeoJSON.
  **Production-traffic warning:** `tile.openstreetmap.org` is OSM's shared, volunteer-funded tile
  service, governed by its own [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/),
  and is meant for light/development use, not sustained public traffic. It is acceptable for this
  initial low-traffic prototype at `tinytownsatlas.github.io` but should be replaced with a
  production-suitable tile provider (e.g. a paid/free-tier hosted basemap, or self-hosted tiles)
  before the site sees substantial public traffic.
- One GeoJSON source (`towns.geojson`) with **Point** geometry (representative point per UCL) drives
  a `circle` layer at all zooms for the MVP. This satisfies "at national zoom prefer points" and
  keeps the MVP simple; polygon rendering at close zoom is listed in the brief as a nice-to-have
  ("can be shown") but is not required for done-ness, so it is deferred past MVP (polygon geometry
  is still produced and stored in the GeoJSON as a `polygon` property — simplified, encoded as a
  nested GeoJSON geometry string — so a later iteration can add it without a new build step).
- Circle color = neutral default layer (Remoteness Area, categorical). An indicator picker can
  switch the paint expression to the (opt-in) diabetes layer. Switching layers never re-sorts or
  ranks towns; it only changes `circle-color`/`circle-radius` paint expressions driven by
  `indicators.json` metadata (min/max domain, color scale, "categorical vs continuous").
- Click on a circle (or a search result) selects a town: opens the panel, flies the map to it,
  updates URL state. Hover shows a lightweight tooltip (name, state) — no numbers in the hover
  tooltip, to avoid inviting comparison-by-hover.

## Chart strategy

- **Observable Plot** for all distribution visuals: one small module (`charts.ts`) building
  reusable "distribution strip" plots (a horizontal dot/rug plot of all towns in a comparator group,
  median + IQR band, selected-town marker highlighted). The same function renders the national
  strip and the same-Remoteness-Area strip, parameterized by the comparator subset.
- No bar-chart league tables, no sorted rankings, no axis labelled by rank. Charts always plot the
  indicator value on a continuous axis; town identity is only revealed for the selected town (and,
  on hover, for any point — but hover reveals value + name, not position/rank).
- Charts render as inline SVG (Plot's default), so no canvas/webgl chart runtime dependency beyond
  the `@observablehq/plot` package.

## URL / state handling

- Single source of truth: a small `state.ts` module holds `{ selectedUclCode, layer }` and
  serializes it to the URL via `URLSearchParams` (`?town=UCL123456&layer=diabetes`), using
  `history.replaceState` on internal changes and `pushState` only on an explicit new selection, so
  back/forward moves between towns. No router library — two URL params do not justify one.
- On load, `main.ts` parses the URL, hydrates state, and (if `town` is present and valid) opens the
  panel and centers the map without an animated fly-to, so shared links land instantly on the right
  town.
- Search selecting a town, and clicking a map point, both go through the same
  `selectTown(uclCode)` function, which updates state (and therefore the URL) — a single code path
  keeps map, panel and URL always consistent.

## Mobile behavior

- CSS media queries only (no separate mobile bundle). Breakpoint ~ 700px.
- Desktop: fixed-width side panel docked right, map fills the remaining viewport.
- Mobile: panel becomes a bottom sheet (three states: hidden / peek with headline stat / expanded
  full-height scroll), map fills the viewport behind it. Implemented with a CSS class toggle plus
  `transform: translateY(...)`, driven by a drag/tap handler in `panel.ts` — no extra dependency.
- Search box is full-width and reachable with one tap on both layouts; it sits above the map as an
  overlay, not inside the panel, so it works even when the panel is hidden.

## Deployment

- **GitHub Actions -> GitHub Pages.** `.github/workflows/deploy.yml` runs `npm ci && npm run build`
  on push to `main`, then deploys `dist/` via `actions/deploy-pages`. Deployed at
  `TinyTownsAtlas/tinytownsatlas.github.io`, an organization **root** Pages site served at
  `https://tinytownsatlas.github.io/`. Vite's `base` config defaults to `"/"` (`vite.config.ts`),
  which is correct for a root site; the `BASE_PATH` env var exists only in case this is ever
  redeployed as a project Pages site under a subpath instead, and is not set in the workflow.
- No secrets are required (Pages deploy uses the default `GITHUB_TOKEN`).
- The Python build step (`scripts/build_data.py`, `scripts/build_geometry.py`) runs **locally**,
  ahead of time, and commits its static output (`public/data/*`) to the repo. GitHub Actions itself
  never runs Python or touches GeoPandas — this keeps the CI job to "install Node, build, deploy"
  and avoids a GDAL/GeoPandas install step in CI, which is slow and failure-prone. If the source
  data changes, a maintainer re-runs the Python build locally and commits the refreshed
  `public/data/*` files.

## Dependencies and why each is needed

Runtime (bundled into the site):
- `maplibre-gl` — the map. Open-source, no API key, matches the brief.
- `@observablehq/plot` — distribution charts with minimal code; avoids hand-rolling SVG scales.
- `d3-array` (transitive via Plot, not a direct dependency) — no direct addition needed.

Dev-only (build tooling):
- `vite` — dev server + bundler, per the brief.
- `typescript` — vanilla TS per the brief.
- `vitest` — lightweight unit tests for `search.ts`/`state.ts`/formatting logic (no browser test
  runner needed for MVP; manual QA covers the map/UI).

Build-time (Python, not shipped):
- `geopandas`, `shapely`, `pyogrio` — read the ABS shapefile, join, simplify, export GeoJSON.
- `pandas` — CSV -> JSON transforms for indicator/town data.

No React, no state-management library, no CSS framework, no charting-as-a-service, no analytics,
no authentication — none of these are needed for a static public MVP and each is explicitly listed
in the brief as something to avoid or not required.
