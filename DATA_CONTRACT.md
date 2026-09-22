# DATA CONTRACT

## Canonical source

- Analytic dataset: `01_public_source/zenodo/diabetes_ucl_analytic_dataset.csv` (1,743 UCLs,
  57 fields), codebook: `01_public_source/zenodo/codebook.csv`. CC BY 4.0. Zenodo DOI
  `10.5281/zenodo.22783233`.
- Geometry: ABS ASGS Edition 3, "Urban Centres and Localities — 2021 — Shapefile", GDA2020,
  downloaded from abs.gov.au (`UCL_2021_AUST_GDA2020_SHP.zip`, 1,837 UCL features). CC BY 4.0.
  Join key: analytic `ucl_code` (e.g. `UCL101001`) == `"UCL" + shapefile UCL_CODE21`
  (e.g. `101001`). All 1,743 analytic codes matched 1:1 against the shapefile with zero
  unmatched and zero duplicates (verified at build time; see `scripts/validate.py`).

Both sources are used unmodified as their own provenance record; neither is edited in place.

## Source fields (as delivered, verbatim from codebook.csv)

Identifiers: `ucl_code`, `ucl_name`, `state_code`, `state_name`.
Geography: `remoteness_code`, `remoteness_name` (1=Major Cities … 5=Very Remote, derived by the
source authors from official ABS SA1-to-Remoteness-Area and SA1-to-UCL allocation files).
Population: `population`, `log2_population`, `pop_bin`.
Outcome: `diabetes_count`, `diabetes_denominator`, `diabetes_pct` — **Census-reported diagnosed
long-term diabetes** (doctor/nurse-diagnosed, excludes gestational diabetes), *not* clinical
prevalence, *not* age-standardised.
Age structure: `age_0_4` … `age_85plus` (counts), `age0_14_pct` … `age65plus_pct` (shares).
Context indicators (count/denominator/pct triples): `indigenous_*`, `degree_*`, `low_income_*`,
`unemployed_residents_*`, `labour_force_residents_*`, `crowded_*`, `social_housing_*`,
`need_assistance_*`, `born_overseas_nes_*`.

Each `*_pct` field's denominator is **not always total population** (e.g. `low_income_denominator`
is households; `crowded_denominator`/`social_housing_denominator` are enumerated population, not
usual residents). The site must always display the field's own denominator next to its percentage,
never assume "out of population".

## Derived public fields (computed at build time, in `scripts/build_data.py`)

- `scope`: `"primary"` if `200 <= population <= 1499`, else `"reference_only"`. Drives what is shown
  on the map (primary universe only) vs. what is available for comparator distributions (full
  1,743-row reference set).
- `remoteness_group_stats` / `national_stats`: per-indicator median, Q1, Q3, P10, P90, n, computed
  once at build time over (a) all primary-scope towns and (b) each Remoteness Area's primary-scope
  towns. Stored in `indicators.json` (not per-town), so the frontend never recomputes distribution
  statistics from raw rows at runtime — it only looks up precomputed summary stats and renders the
  full set of raw values for the strip/rug plot.
- `centroid_lon` / `centroid_lat`: representative point per UCL (geopandas `representative_point()`,
  guaranteed inside the polygon, unlike a naive centroid which can fall outside for concave/multi-
  part UCLs), from the ABS geometry, in WGS84 (EPSG:4326) for MapLibre.
- `polygon`: simplified UCL boundary (Douglas-Peucker, tolerance chosen per `validate.py` output to
  keep total GeoJSON under ~2 MB), reprojected to WGS84. Stored but not rendered in the MVP map
  layer (see ARCHITECTURE.md); kept so a later release can add polygon rendering at close zoom
  without a new geometry build.

No other derived fields (no composite index, no z-score, no rank, no percentile-of-town — see
"Fields that must never be treated as rankings" below for why percentile is deliberately not
precomputed per-town).

## Comparator groups

Exactly two, both defined over **primary-scope towns only** (population 200–1,499):

1. **National tiny-town distribution** — all 1,148 primary-scope UCLs.
2. **Same-Remoteness-Area distribution** — primary-scope UCLs sharing the selected town's
   `remoteness_name` (five possible groups; group sizes vary and are always shown, e.g. "n=214").

The full 1,743-row reference dataset (`towns_full.json`) exists only for build-time validation and
for any future reference-distribution view explicitly requested (per brief: "Keep the full
1,743-UCL public analytic dataset available for reference distributions and validation"); the MVP
UI does not surface a third comparator group against it, to avoid multiplying distributions beyond
what the brief's MVP scope (national + same-Remoteness-Area) asks for.

## Display precision

- Percentages: **one decimal place** (e.g. `4.5%`), except where the underlying denominator is
  small enough that one decimal implies false precision — see "small-population handling" below.
- Population: whole number, thousands separator (e.g. `1,148`, `37,511`).
- Distribution summary stats (median/IQR/P10-P90) inherit the same one-decimal-place rule as the
  indicator they summarize.
- No field is ever displayed with more precision than one decimal place; raw CSV values carry far
  more (e.g. `4.486091341864567`), but the UI always formats through `format.ts`, never interpolates
  a raw float into the DOM.

## Missing-data handling

The 1,743-row analytic dataset has **zero missing values** in any of the fields listed above
(verified at build time: `diabetes_pct` and all other `*_pct`/`*_count` fields are fully populated
for every row — ABS Census TableBuilder small-cell perturbation adjusts small counts but does not
suppress them here). `validate.py` asserts this on every build and **fails the build** if a future
data refresh introduces nulls, rather than silently rendering a blank field. If a future dataset
does contain missing values, the contract is: show "not available for this town" text in the panel,
never a zero, blank, or interpolated value, and exclude the town from that indicator's distribution
(not from the map or from other indicators).

## Small-population handling

- Every displayed percentage is shown with its numerator/denominator (e.g. "diabetes: 4.5%
  (14 of 312 residents)"), per the brief's "show denominator/population context" and "avoid false
  precision" requirements.
- No high or low values are trimmed, winsorised, or capped (the source manuscript explicitly
  rejected winsorisation as a methodological choice — see
  `02_research_context/smalltowns_au_recovery_audit.md` — and the site preserves that decision).
- The About/interpretation drawer must state, for every indicator, that small-town percentages are
  based on small denominators and can swing on a handful of people, and must not be read as a
  precise underlying rate.

## Indicator metadata schema (`public/data/indicators.json`)

```jsonc
{
  "diabetes_pct": {
    "key": "diabetes_pct",
    "label": "Census-reported diabetes",
    "shortLabel": "Diabetes",
    "unit": "percent",
    "precision": 1,
    "numeratorField": "diabetes_count",
    "denominatorField": "diabetes_denominator",
    "denominatorLabel": "usual residents",
    "category": "health",
    "isDefaultMapLayer": false,
    "isRankable": false,           // always false; enforced, see below
    "colorScale": "sequential",
    "domain": [0, 15.83],           // observed min/max across primary scope, from build time
    "description": "...",
    "caveats": [
      "Census-reported diagnosed long-term diabetes, not clinical prevalence.",
      "Excludes gestational diabetes.",
      "Small towns: based on a small denominator; treat as indicative, not precise."
    ],
    "source": "ABS 2021 Census of Population and Housing, TableBuilder",
    "nationalStats": { "median": 5.67, "q1": 0, "q3": 0, "p10": 0, "p90": 0, "n": 1148 },
    "remotenessStats": { "Major Cities of Australia": { "median": 0, "...": 0, "n": 0 }, "...": {} }
  }
}
```

Every indicator entry is required to carry `caveats` (>=1 entry) and `source`. The frontend build/
lint step (`validate.py`, run before `npm run build`) fails if any indicator lacks either.

## Provenance / licensing metadata (`public/data/manifest.json`)

```jsonc
{
  "generatedAt": "2026-09-23T00:00:00Z",
  "sources": [
    {
      "name": "Diabetology UCL analytic dataset",
      "doi": "10.5281/zenodo.22783233",
      "license": "CC BY 4.0",
      "attribution": "Alexeev, Gwynne, Henson & Kirwan (2026); Australian Bureau of Statistics",
      "rowCount": 1743
    },
    {
      "name": "ABS ASGS Edition 3 — Urban Centres and Localities 2021 (GDA2020 shapefile)",
      "license": "CC BY 4.0",
      "attribution": "Australian Bureau of Statistics",
      "featureCount": 1837,
      "matchedCount": 1743
    }
  ],
  "scopeDefinition": "Primary display universe: UCL population 200-1,499 (analytical choice, not an ABS town definition).",
  "primaryCount": 1148,
  "referenceCount": 1743
}
```

This file backs the site's "About these data / sources" view. It is generated fresh on every
`build_data.py` run — never hand-edited.

## Fields that must never be treated as rankings

Enforced structurally, not just by convention:

- No field in `indicators.json` or `towns.json` is named/typed as a rank, percentile-of-town, score,
  or index. `isRankable` is hardcoded `false` for every indicator (present in the schema only so a
  future contributor sees the flag and cannot silently add a `true`).
- The frontend never sorts the town list by an indicator value for display purposes (search sorts
  by text-match relevance/alphabetically only; the map never colors by rank, only by raw value on a
  continuous scale).
- Distribution charts show the selected town positioned among *all* other towns' raw values
  (a strip/rug plot ordered by indicator value, which is the standard, honest way to show "where
  does this one point sit in this distribution" — this is not a ranking, it carries no ordinal
  number, label, or "town N of 1148" text, and adjacent towns are not identified unless hovered).
- `indigenous_pct` is present in `indicators.json` under `category: "context"`, `isDefaultMapLayer:
  false`, and is never selectable as the map's disease/health layer — it can only appear in the
  town panel's descriptive "People and context" section, alongside the other social indicators,
  with no color-coded map layer of its own in the MVP.
- No leave-one-out residual, observed-vs-expected, or model-based field exists anywhere in the
  pipeline (the source archive deliberately excludes these; the site build never derives them).
