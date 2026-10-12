"""Hand-written indicator metadata: label, category, caveats, source.

Kept separate from build_data.py so the editorial content (labels/descriptions/caveats) is easy to
review independently of the statistics-computation code.

Every indicator listed here must have a numerator/denominator/percentage triple in the analytic CSV
named f"{key}_count", f"{key}_denominator", f"{key}_pct" (diabetes uses the same pattern).

Fields used by the frontend beyond label/caveats/source:
  - category: "health" indicators appear in the town panel's outcome selector; "context"
    indicators appear in "People and context".
  - mapLayer: True makes the indicator an opt-in map colour layer. Only "health" indicators may
    set it (build_data.py and validate.py enforce this); remoteness stays the default layer.
  - definition: one sentence shown next to the value, so the denominator and what the measure is
    (and is not) are visible without opening the methodology drawer.

Indicators are listed in display order.
"""

ABS_CENSUS_SOURCE = "ABS 2021 Census of Population and Housing, TableBuilder"
SMALL_DENOMINATOR_CAVEAT = (
    "Small towns: based on a small denominator and can swing sharply on a handful of "
    "people. Treat as indicative, not a precise underlying rate."
)

INDICATORS = {
    "diabetes_pct": {
        "label": "Census-reported diabetes",
        "shortLabel": "Diabetes",
        "denominatorLabel": "usual residents",
        "category": "health",
        "mapLayer": True,
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with "
            "diabetes by a doctor or nurse."
        ),
        "definition": (
            "Usual residents reporting diabetes (excluding gestational diabetes) as a long-term "
            "health condition in the 2021 Census, out of all usual residents."
        ),
        "caveats": [
            "Census-reported diagnosed long-term diabetes, not clinical prevalence.",
            "Excludes gestational diabetes; does not identify diabetes type or severity.",
            "Not age-standardised: towns with older populations will tend to show higher rates.",
            SMALL_DENOMINATOR_CAVEAT,
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "cancer_pct": {
        "label": "Census-reported cancer (including remission)",
        "shortLabel": "Cancer",
        "denominatorLabel": "usual residents",
        "category": "health",
        "mapLayer": True,
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with cancer "
            "(including cancer in remission) by a doctor or nurse."
        ),
        "definition": (
            'Usual residents reporting "Cancer (including remission)" as a long-term health '
            "condition in the 2021 Census, out of all usual residents."
        ),
        "caveats": [
            "A Census-reported long-term condition that includes cancer in remission; not cancer "
            "registry incidence and not a clinically measured prevalence estimate.",
            "Does not identify cancer type, stage or when it was diagnosed.",
            "Not age-standardised: towns with older populations will tend to show higher rates.",
            SMALL_DENOMINATOR_CAVEAT,
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "indigenous_pct": {
        "label": "Aboriginal and/or Torres Strait Islander population",
        "shortLabel": "Aboriginal and Torres Strait Islander",
        "denominatorLabel": "usual residents",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": "Share of usual residents who identified as Aboriginal and/or Torres Strait Islander.",
        "definition": "Out of all usual residents.",
        "caveats": [
            "Shown as descriptive Census context only.",
            "Not a disease, deficit, or evaluative measure, and not available as a map colour layer.",
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "degree_pct": {
        "label": "Degree-level qualification",
        "shortLabel": "Degree qualification",
        "denominatorLabel": "usual residents",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": "Share of usual residents with a bachelor degree, postgraduate degree, or graduate diploma/certificate.",
        "definition": "Out of all usual residents, including children; not an adult attainment rate.",
        "caveats": ["Descriptive Census context, not a ranking of towns."],
        "source": ABS_CENSUS_SOURCE,
    },
    "low_income_pct": {
        "label": "Lower-income households",
        "shortLabel": "Lower income",
        "denominatorLabel": "households",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": "Share of households in nil-income or lower weekly equivalised-income categories (below $650/week).",
        "definition": "Households with nil or equivalised weekly income below $650, out of all households.",
        "caveats": ["Household-level share, not a per-person share.", "Descriptive Census context, not a ranking of towns."],
        "source": ABS_CENSUS_SOURCE,
    },
    # The conventional Census unemployment rate replaces the published dataset's
    # "unemployed_residents" share (unemployed / all usual residents) in the Atlas display. That
    # share stays in the analytic CSV because the published diabetes model used it and the Zenodo
    # regression check compares it.
    "unemployment_rate_pct": {
        "label": "Unemployment rate",
        "shortLabel": "Unemployment rate",
        "denominatorLabel": "people in the labour force",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Unemployed usual residents as a share of usual residents in the labour force "
            "(employed or unemployed, aged 15 and over)."
        ),
        "definition": (
            "Unemployed people out of the labour force (employed + unemployed, aged 15+), as in "
            "ABS Census QuickStats for this town. Local Government Area figures cover a wider "
            "area and differ."
        ),
        "caveats": [
            "Census labour force status in August 2021; not the ABS Labour Force Survey "
            "unemployment rate.",
            "The labour force in a tiny town can be a few dozen people, so the rate can move "
            "sharply with a handful of people.",
            "Descriptive Census context, not a ranking of towns.",
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "labour_force_residents_pct": {
        "label": "In the labour force (of all residents)",
        "shortLabel": "In the labour force",
        "denominatorLabel": "usual residents (all ages)",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": "Usual residents in the labour force as a share of all usual residents.",
        "definition": (
            "Out of all usual residents, including children; lower than the conventional "
            "participation rate, which uses people aged 15+."
        ),
        "caveats": [
            "Denominator is all usual residents including children, so this is lower than the "
            "conventional labour force participation rate.",
            "Descriptive Census context, not a ranking of towns.",
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "crowded_pct": {
        "label": "People in crowded dwellings",
        "shortLabel": "Crowding",
        "denominatorLabel": "enumerated people",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": "Share of enumerated people living in crowded dwellings.",
        "definition": "Out of people counted in the town on Census night (place of enumeration), not usual residents.",
        "caveats": [
            "Denominator is enumerated population (place counted), not usual residents.",
            "Descriptive Census context, not a ranking of towns.",
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "social_housing_pct": {
        "label": "People in social housing",
        "shortLabel": "Social housing",
        "denominatorLabel": "enumerated people",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": "Share of enumerated people in social housing dwellings.",
        "definition": "Out of people counted in the town on Census night (place of enumeration), not usual residents.",
        "caveats": [
            "Denominator is enumerated population (place counted), not usual residents.",
            "Descriptive Census context, not a ranking of towns.",
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "need_assistance_pct": {
        "label": "Need for core assistance",
        "shortLabel": "Need assistance",
        "denominatorLabel": "usual residents",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": "Share of usual residents needing assistance with core activities (self-care, mobility, communication) due to disability, long-term illness, or old age.",
        "definition": "Usual residents needing help with self-care, mobility or communication, out of all usual residents.",
        "caveats": ["Descriptive Census context, not a ranking of towns."],
        "source": ABS_CENSUS_SOURCE,
    },
    "born_overseas_nes_pct": {
        "label": "Born overseas (non-English-speaking country)",
        "shortLabel": "Overseas-born (NES)",
        "denominatorLabel": "usual residents",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": "Share of usual residents born overseas in a predominantly non-English-speaking country.",
        "definition": "Out of all usual residents.",
        "caveats": ["Descriptive Census context, not a ranking of towns."],
        "source": ABS_CENSUS_SOURCE,
    },
}

# The neutral default map layer is categorical, not one of the percentage indicators above.
DEFAULT_MAP_LAYER = "remoteness_name"
