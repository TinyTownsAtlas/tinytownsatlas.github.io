# DATA CONTRACT

## Population scope

The Atlas's primary universe is **UCLs with 100–1,499 usual residents**, excluding special/
non-settlement records. This is a Tiny Towns Atlas product definition, not an ABS definition of a
town. It was lowered from 200 to 100 in October 2026 so that communities of 100–199 residents
(relevant to Ten4Ten) are included. The companion Diabetology manuscript analyses 1,743 UCLs with
at least 200 usual residents. The Atlas displays a distinct universe of 1,208 towns with 100–1,499
usual residents and includes additional Census-reported health indicators and broader-area
hospitalisation context. It is a related resource, not a replication or validation of the
manuscript's results.

## Canonical source

- Census data: the canonical PHIDU/John Glover master workbook,
  `05_source_archive/PHIDU_John_Glover/2026-09-23_final_delivery/_data_workbook-witth_details.xlsx`
  (1,836 UCL records; ABS 2021 Census TableBuilder counts). `scripts/build_analytic.py` turns it into
  `06_derived_data/census/atlas_ucl_dataset.csv` (every settlement UCL with 100+ residents; 1,803
  rows at the October 2026 build), applying the diabetes paper's rules unchanged:
  - special/non-settlement records excluded by name — "Remainder of State/Territory",
    "Migratory - Offshore - Shipping", "No usual address" (27 records), cross-checked against their
    reserved codes;
  - 2021 Remoteness Area from the official ABS SA1-to-RA and SA1-to-UCL allocation files; a UCL must
    lie wholly within one Remoteness Area or the build fails;
  - the same workbook columns for every indicator count and denominator.

  Every excluded record and its reason is written to `atlas_ucl_dataset_exclusions.csv`.
- Public data comparison: `01_public_source/zenodo/diabetes_ucl_analytic_dataset.csv` (1,743 UCLs
  with 200+ residents, the manuscript's analysis sample), codebook `01_public_source/zenodo/codebook.csv`.
  CC BY 4.0. Zenodo DOI `10.5281/zenodo.22783233`. `build_analytic.py` checks that the 200+ source
  records match this file (codes, population, counts, denominators, state, Remoteness Area); this is
  a data-consistency check, not validation of the manuscript's findings.
- Geometry: ABS ASGS Edition 3, "Urban Centres and Localities — 2021 — Shapefile", GDA2020,
  downloaded from abs.gov.au (`UCL_2021_AUST_GDA2020_SHP.zip`, 1,837 UCL features). CC BY 4.0.
  Join key: analytic `ucl_code` (e.g. `UCL101001`) == `"UCL" + shapefile UCL_CODE21`
  (e.g. `101001`). All 1,803 Atlas codes matched 1:1 against the shapefile with zero
  unmatched and zero duplicates (verified at build time; see `scripts/validate.py`).

Both sources are used unmodified as their own provenance record; neither is edited in place.

## Source fields (Atlas dataset; names follow the Zenodo codebook.csv)

Identifiers: `ucl_code`, `ucl_name`, `state_code`, `state_name`.
Geography: `remoteness_code`, `remoteness_name` (1=Major Cities … 5=Very Remote, derived by the
source authors from official ABS SA1-to-Remoteness-Area and SA1-to-UCL allocation files).
Population: `population`, `log2_population`, `pop_bin`.
Outcome: `diabetes_count`, `diabetes_denominator`, `diabetes_pct` — **Census-reported diagnosed
long-term diabetes** (doctor/nurse-diagnosed, excludes gestational diabetes), *not* clinical
prevalence, *not* age-standardised.
Age structure: `age_0_4` … `age_85plus` (counts), `age0_14_pct` … `age65plus_pct` (shares).
Context indicators (count/denominator/pct triples): `indigenous_*`, `degree_*`, `low_income_*`,
`unemployed_residents_*` (analytic CSV only; not displayed, see below), `labour_force_residents_*`,
`crowded_*`, `social_housing_*`, `need_assistance_*`, `born_overseas_nes_*`.

### Atlas-only fields (not in the published Zenodo dataset)

Read by `build_analytic.py` from the same master workbook. The build checks each column's header
label and the Census table block it sits under (row 1), and fails if either differs.

- `cancer_count`, `cancer_denominator`, `cancer_pct` — **Census-reported cancer (including
  remission)**: workbook `P_Cancer_Tot` / `Tot_P_P` in block "LTHP Type of Long-term Health
  Condition, 2021 Census - counting persons, place of usual residence". The ABS Census category
  is "Cancer (including remission)" (QuickStats wording). It is a Census-reported long-term
  condition, not cancer registry incidence, not a clinically measured prevalence, and not
  age-standardised. National and same-Remoteness-Area distributions are computed exactly as for
  diabetes.
- `unemployment_rate_count`, `unemployment_rate_denominator`, `unemployment_rate_pct` — the
  **conventional Census unemployment rate**: workbook `Unemployed` / `Labour force participation`
  (block "LFSP Labour Force Status", place of usual residence). The "Labour force participation"
  column is the labour force count (employed + unemployed, aged 15+); the male and female labour
  force columns sum to it within Census perturbation (maximum difference 11 across the 1,836
  workbook UCLs).

Town-level anchors checked against ABS 2021 Census QuickStats for the same UCL
(Brewarrina (L), UCL121013, checked 13 October 2026) and enforced by `validate.py`: diabetes 52 of
743 (7.0%); cancer (including remission) 13 of 743 (1.7%); unemployed 13 of 254 in the labour force
(5.1%).


### All ten Census long-term conditions (UX2)

The same LTHP block supplies all ten outcomes. The following are independently verified 0-based
numerator/denominator column indices; every denominator header is `Tot_P_P` (all usual residents).
The build checks each exact header and the complete LTHP block wording/geography and fails if a
new block appears inside columns 8–47. Each outcome has the same primary-universe national and
same-Remoteness-Area distribution calculations. Existing diabetes/cancer outputs are regression
checked unchanged.

| Stem | Numerator header | Columns |
|---|---|---|
| arthritis | P_Arthritis_Tot | 8 / 9 |
| asthma | P_Asthma_Tot | 12 / 13 |
| cancer | P_Cancer_Tot | 16 / 17 |
| dementia | P_Dementia_Tot | 20 / 21 |
| diabetes | P_Diabetes_Tot | 24 / 25 |
| heart_disease | P_Heart_disease_Tot | 28 / 29 |
| kidney_disease | P_Kidney_disease_Tot | 32 / 33 |
| lung_condition | P_Lung_cond_Tot | 36 / 37 |
| mental_health | P_Mental_health_cond_Tot | 40 / 41 |
| stroke | P_Stroke_Tot | 44 / 45 |

Full category definitions follow the [ABS 2021 LTHP dictionary](https://www.abs.gov.au/census/guide-census-data/census-dictionary/2021/variables-topic/health/type-long-term-health-condition-lthp),
including remission for cancer, Alzheimer's for dementia, heart attack or angina for heart disease,
COPD or emphysema for lung condition, and depression or anxiety for mental health condition.
These are Census-reported doctor/nurse-diagnosed long-term conditions, not clinical prevalence
estimates. They are not age-standardised; small denominators and Census perturbation affect
interpretation. Multiple conditions can be reported, so these percentages must not be summed.

The landing scope is explicit: **Tiny towns with 100–1,499 usual residents**. Point area encodes
population consistently across all layers. The All towns default adds no category/measure colour;
Remoteness (ABS) is optional geographic accessibility context and remains a comparator grouping.

### Unemployment display change (October 2026)

The Atlas previously displayed `unemployed_residents_pct` (unemployed / **all usual residents**,
1.7% for Brewarrina). User feedback showed this was read as an unemployment rate even with a
caveat. The display now uses `unemployment_rate_pct` (unemployed / labour force, 5.1% for
Brewarrina, matching ABS QuickStats for the UCL). `unemployed_residents_*` stays in the analytic
CSV because the published diabetes model used it and the Zenodo reproduction check compares it,
but it is not in `indicators.json`, and `validate.py` fails if it returns there.

The 7.1% figure sometimes quoted for Brewarrina is the ABS QuickStats figure for Brewarrina Local
Government Area (LGA11200: 34 unemployed of 481 in the labour force), a wider area than the
Brewarrina (L) UCL. Brewarrina suburb/locality (SAL10560) is different again (25 of 321, 7.8%).

`labour_force_residents_pct` is still out of all usual residents (all ages), so it is labelled
"In the labour force (of all residents)". It is not the conventional participation rate, which
uses people aged 15+ (44.3% for Brewarrina in QuickStats versus 34.2% here).

### Hospital services: broader-area context (PHIDU, PHA-derived)

Published separately in `public/data/hospital_context.json`. Two opt-in SR-only point colour
layers surface this context near the top of the profile when active. These remain broader-area
estimates, never direct town observations: no town distributions, no entry in Census
`indicators.json`, no allocated admission counts. The scale is centred on Australia = 100,
with equal log-ratio distances from 50 to 100 and 100 to 200; colours saturate outside 50–200.
Missing/suppressed/uninterpretable statuses use a separate neutral colour, never zero.

**Source.** `05_source_archive/PHIDU_John_Glover/prior_validated_sources/Hospital_data_workbook.xlsx`
(sha256 checked against `diabetology_source_manifest.csv`), sheet `Data`, with definitions in
`data_sources_notes-final.docx` and PHA flags (`PHA_CODE_2021`, `PHA_NAME`, block "UCL Flag -
Hospital and Mortality data") from the September 2026 master workbook.
`scripts/build_phidu_context.py` checks every header label and writes
`06_derived_data/phidu_context/atlas_hospital_context.csv` plus a provenance file.

| Atlas key | Workbook block / measure | Columns | Period |
|---|---|---|---|
| `public_admissions` | "Hospital admissions - Public hospitals" / "Total admissions" (excludes same-day renal dialysis) | 2-4 (Number, Rate, SR) | 2022/23 |
| `pph` | "Potentially preventable hospitalisations (PPH) - Public hospitals" / "PPH admissions for all conditions" | 21-23 | 2020/21 (2022/23 not yet available from PHIDU) |

Only the SR (indirectly age-standardised ratio, Australia = 100) is published. The workbook's
`Total` row has SR = 100 for both, and the build checks this.

**Geography.** PHIDU applied each UCL's share of its Population Health Area's population to the
PHA's observed and expected admissions and recalculated the ratio, so every UCL drawn from one PHA
carries the same SR (the build fails otherwise; observed spread is below 1e-12). The master
workbook's PHA flag lists the 1,568 UCLs that PHIDU split from a PHA (UCLs with under 50% of the
PHA's population); this set matches the hospital workbook's `UCL_aggregations` sheet exactly (build
check). 1,163 of the 1,208 Atlas towns are in that set. For the other 45 (including Currie),
PHIDU did not supply a PHA code or name, and the files do not establish which PHA or boundary was
used (PHIDU's notes say only which UCLs are in the split list). The panel says the area was not
identified and does not name or describe one. The flag covers only UCLs with under 50% of their
PHA: each PHA's main UCL (usually a larger town outside the Atlas scope, e.g. Broken Hill for the
Wilcannia/Ivanhoe/Menindee PHA) is unflagged but carries identical ratios. The build retains its validated all-workbook matching-value count (`sharedUclCount`) for
compatibility, but the UI now uses the more conservative supplied source geography: it counts and
outlines **other primary Atlas towns** with the same supplied PHA code and a published selected
measure. This avoids implying a known shared source area from matching numbers, or claiming
that suppressed PPH values match. The count excludes unflagged larger UCLs and can therefore be
smaller than `sharedUclCount - 1`. For the 45 towns without a supplied PHA code, the UI says the
area was not identified and does not infer peers, names or boundaries. Outlines are town markers,
not geographic boundaries.

**Missing values.** Workbook symbols are kept as statuses, never as zeros: `#` (number not shown:
population under 100 or fewer than 6 admissions) with `..` for the rate and ratio ->
`suppressed` (160 Atlas towns for PPH, none for admissions); `n.a.` -> `not_available` (the four
Other Territories towns). Uriarra Village (L), ACT, is `not_interpretable` for both: every one of
its 84 numeric cells in the workbook (all admissions, PPH and ED measures) is 0, the same pattern
as the two no-resident "Migratory - Offshore - Shipping" records (UCL179997, UCL879997) and no other
UCL. That reads as no data assigned rather than observed zero admissions, but the source does not
say which, so the value is withheld with that explanation. Any other zero ratio stops the build.

**Comparability.** PHIDU notes that hospital scope differs between states and territories and that
results are not always comparable between jurisdictions; data by hospital type were not supplied
for Qld, Tas, NT or ACT. These are public-hospital admissions only, by place of residence, with
transfers and repeat admissions counted separately. PHIDU advises extra care where a UCL has a
larger share of Aboriginal and Torres Strait Islander residents than its PHA. Brewarrina (54%;
"Bourke - Brewarrina/ Walgett - Lightning Ridge" PHA) and Laura (Qld) (75%; "Far North (Qld)" PHA)
are examples. These caveats are shown in the section itself.

**Licence.** PHIDU content is licensed CC BY-NC-SA 3.0 AU (stated in the delivered notes, with
PHIDU's licensing and attribution policy link). `hospital_context.json` is a separately
identifiable derived dataset under that licence and carries its own licence block (attribution to
PHIDU, licence URL, list of changes). The Atlas's Census data (CC BY 4.0) and site code (MIT) are
not relicensed. The archived delivery email and the PHIDU correspondence in the project mailbox
(searched October 2026) set no further publication conditions for the hospital estimates; John
Glover asked that attribution be to PHIDU. The separate permission question in that
correspondence concerned SA2 mortality data, which the Atlas does not use.

`validate.py` checks the licence block, that the town set equals the primary towns, that entries
carry only a status and SR (no counts), that towns from one PHA share one SR, and source values for
Brewarrina, Laura and Currie.

Each `*_pct` field's denominator is **not always total population** (e.g. `low_income_denominator`
is households; `crowded_denominator`/`social_housing_denominator` are enumerated population, not
usual residents). The site must always display the field's own denominator next to its percentage,
never assume "out of population".

## Derived public fields (computed at build time, in `scripts/build_data.py`)

- `scope`: `"primary"` if `100 <= population <= 1499`, else `"reference_only"`. Drives what is shown
  on the map and used in comparator distributions (primary universe only) vs. the full 1,803-row
  reference set kept for validation.
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

Exactly two, both defined over **primary-scope towns only** (population 100–1,499):

1. **National tiny-town distribution** — all primary-scope UCLs (1,208 at the October 2026 build;
   1,148 before the lower bound changed from 200 to 100).
2. **Same-Remoteness-Area distribution** — primary-scope UCLs sharing the selected town's
   `remoteness_name` (five possible groups; group sizes vary and are always shown, e.g. "n=214").

The full reference dataset (`towns_full.json`, every settlement UCL with 100+ residents) exists
only for build-time validation and for any future reference-distribution view explicitly requested
(per brief: "Keep the full public analytic dataset available for reference distributions and
validation"); the MVP
UI does not surface a third comparator group against it, to avoid multiplying distributions beyond
what the brief's MVP scope (national + same-Remoteness-Area) asks for.

## Community tags (Ten4Ten)

`data/ten4ten_communities.csv` (`ucl_code`, `ucl_name`, optional `community_label`) lists towns
tagged as Ten4Ten communities. `community_label` gives the Ten4Ten community name where it differs
from the UCL name (e.g. Currie (L) is the King Island community); it is shown in the badge
("Ten4Ten community · King Island") and matched by search, but the UCL name and geography are
unchanged. `build_data.py` checks each entry is an existing primary-scope town with a matching
name and writes `public/data/ten4ten.json`; `validate.py` re-checks it. The tag is display-only: a
badge on the town profile and in search results, and the search query "Ten4Ten" lists all tagged
towns. It never changes scope, comparator groups, statistics or counts. To tag another town, add
a row to the CSV and re-run `build_data.py` and `validate.py`; no application code changes.

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

The Atlas dataset has **zero missing values** in any of the fields listed above
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
    "mapLayer": true,              // opt-in map colour layer; health indicators only (enforced)
    "isRankable": false,           // always false; enforced, see below
    "colorScale": "sequential",
    "domain": [0, 15.83],           // observed min/max across primary scope, from build time
    "description": "...",
    "definition": "...",           // one sentence shown beside the value, naming the denominator
    "caveats": [
      "Census-reported diagnosed long-term diabetes, not clinical prevalence.",
      "Excludes gestational diabetes.",
      "Small towns: based on a small denominator; treat as indicative, not precise."
    ],
    "source": "ABS 2021 Census of Population and Housing, TableBuilder",
    "nationalStats": { "median": 5.8, "q1": 4.2, "q3": 7.7, "p10": 3.3, "p90": 9.6, "n": 1208 },
    "remotenessStats": { "Major Cities of Australia": { "median": 0, "...": 0, "n": 0 }, "...": {} }
  }
}
```

Every indicator entry is required to carry `caveats` (>=1 entry), `source` and `definition`. The
frontend build/lint step (`validate.py`, run before `npm run build`) fails if any indicator lacks
one. `category: "health"` indicators (the ten Census LTHP conditions) populate the town panel's Health outcome
selector, with national and same-Remoteness-Area distributions; `category: "context"` indicators
populate "People and context". Indicators appear in `indicators.json` order.

## Provenance / licensing metadata (`public/data/manifest.json`)

```jsonc
{
  "generatedAt": "2026-09-23T00:00:00Z",
  "sources": [
    {
      "name": "ABS 2021 Census of Population and Housing (TableBuilder), UCL extract supplied by PHIDU",
      "license": "CC BY 4.0",
      "attribution": "Australian Bureau of Statistics; extract prepared by PHIDU, Torrens University Australia",
      "rowCount": 1803,
      "sha256": "..."
    },
    {
      "name": "Diabetology UCL analytic dataset (validation reference for UCLs with 200+ residents)",
      "doi": "10.5281/zenodo.22783233",
      "license": "CC BY 4.0",
      "attribution": "Alexeev, Gwynne, Henson & Kirwan (2026); Australian Bureau of Statistics",
      "rowCount": 1743
    },
    {
      "name": "ABS ASGS Edition 3 — Urban Centres and Localities 2021 (GDA2020 shapefile)",
      "license": "CC BY 4.0",
      "attribution": "Australian Bureau of Statistics",
      "matchedCount": 1803
    }
  ],
  "scopeDefinition": "Primary display universe: UCLs with 100-1,499 usual residents, excluding special/non-settlement records. ...",
  "primaryMinPopulation": 100,
  "primaryMaxPopulation": 1499,
  "primaryCount": 1208,
  "referenceCount": 1803
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
  number, label, or "town N of 1208" text, and adjacent towns are not identified unless hovered).
- `indigenous_pct` is present in `indicators.json` under `category: "context"`, `isDefaultMapLayer:
  false`, `mapLayer: false` (checked by `validate.py` and `layers.test.ts`), and is never selectable
  as the map's disease/health layer — it can only appear in the
  town panel's descriptive "People and context" section, alongside the other social indicators,
  with no color-coded map layer of its own in the MVP.
- No leave-one-out residual, observed-vs-expected, or model-based field exists anywhere in the
  pipeline (the source archive deliberately excludes these; the site build never derives them).

## Assistant index (`public/data/assistant_index.json`)

Generated by `scripts/build_assistant_index.py` (called at the end of `build_data.py`) from the other public files only. It feeds the optional "Ask Tiny Towns Atlas" Worker (see `worker/README.md`). Contents: scope, deep-link keys, state list, indicator metadata copied from `indicators.json`, hospital definitions/caveats/status text from `hospital_context.json`, and one record per primary town: code, name, state, population, remoteness, Ten4Ten flag/alias, every Census indicator as `[percent, count, denominator]`, and the PHIDU PHA code/name with SR and status for both hospital measures. No allocated counts, no private or Ten4Ten participant data. `validate.py` checks that it matches `towns.json` and `hospital_context.json` exactly and carries no extra fields.

The assistant sorts or filters towns only on one user-named measure at a time, never on a composite. `indigenous_pct` is not used to sort or filter, and hospital measures have no distribution summary. This is a user-requested exception to "the frontend never sorts the town list by an indicator" and applies to the assistant only; the map and panel are unchanged.
