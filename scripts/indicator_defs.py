"""Hand-written indicator metadata: label, category, caveats, source.

Kept separate from build_data.py so the editorial content (labels/descriptions/caveats) is easy to
review independently of the statistics-computation code.

Every indicator listed here must have a numerator/denominator/percentage triple in the analytic CSV
named f"{key}_count", f"{key}_denominator", f"{key}_pct" (diabetes uses the same pattern).
"""

ABS_CENSUS_SOURCE = "ABS 2021 Census of Population and Housing, TableBuilder"

INDICATORS = {
    "diabetes_pct": {
        "label": "Census-reported diabetes",
        "shortLabel": "Diabetes",
        "denominatorLabel": "usual residents",
        "category": "health",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with "
            "diabetes by a doctor or nurse."
        ),
        "caveats": [
            "Census-reported diagnosed long-term diabetes, not clinical prevalence.",
            "Excludes gestational diabetes; does not identify diabetes type or severity.",
            "Not age-standardised: towns with older populations will tend to show higher rates.",
            "Small towns: based on a small denominator and can swing sharply on a handful of "
            "people. Treat as indicative, not a precise underlying rate.",
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
        "caveats": ["Household-level share, not a per-person share.", "Descriptive Census context, not a ranking of towns."],
        "source": ABS_CENSUS_SOURCE,
    },
    "unemployed_residents_pct": {
        "label": "Unemployed residents",
        "shortLabel": "Unemployed (of all residents)",
        "denominatorLabel": "all usual residents",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": "Unemployed usual residents as a share of all usual residents.",
        "caveats": [
            "Denominator is all usual residents, not the labour force — this is not the "
            "conventional unemployment rate.",
            "Descriptive Census context, not a ranking of towns.",
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "labour_force_residents_pct": {
        "label": "Labour force participation",
        "shortLabel": "Labour force",
        "denominatorLabel": "all usual residents",
        "category": "context",
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": "Usual residents in the labour force as a share of all usual residents.",
        "caveats": ["Descriptive Census context, not a ranking of towns."],
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
        "caveats": ["Descriptive Census context, not a ranking of towns."],
        "source": ABS_CENSUS_SOURCE,
    },
}

# The neutral default map layer is categorical, not one of the percentage indicators above.
DEFAULT_MAP_LAYER = "remoteness_name"
