"""Hand-written indicator metadata: label, category, caveats, source.

Kept separate from build_data.py so the editorial content (labels/descriptions/caveats) is easy to
review independently of the statistics-computation code.

Every indicator listed here must have a numerator/denominator/percentage triple in the analytic CSV
named f"{key}_count", f"{key}_denominator", f"{key}_pct" (diabetes uses the same pattern).

Fields used by the frontend beyond label/caveats/source:
  - category: "health" indicators appear in the town panel's outcome selector; "context"
    indicators appear in "People and context".
  - mapLayer: True makes the indicator an opt-in map colour layer. Only "health" indicators may
    set it (build_data.py and validate.py enforce this); All towns is the neutral default.
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
    # The following eight indicators are the other tick-box options in the same 2021 Census LTHP
    # question as diabetes and cancer ("Does the person have a long-term health condition(s)?"),
    # so a person can report more than one of these ten conditions at once; the percentages are
    # not mutually exclusive with each other.
    "asthma_pct": {
        "label": "Census-reported asthma",
        "shortLabel": "Asthma",
        "denominatorLabel": "usual residents",
        "category": "health",
        "mapLayer": True,
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with asthma "
            "by a doctor or nurse."
        ),
        "definition": (
            'Usual residents reporting "Asthma" as a long-term health condition in the 2021 '
            "Census, out of all usual residents."
        ),
        "caveats": [
            "A Census-reported long-term condition, not a clinical "
            "prevalence estimate.",
            "Respondents could mark more than one long-term health condition, so this is not "
            "mutually exclusive with the other Census health indicators (e.g. a person may report "
            "both asthma and diabetes).",
            "Not age-standardised: differences in age structure affect comparisons.",
            SMALL_DENOMINATOR_CAVEAT,
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "arthritis_pct": {
        "label": "Census-reported arthritis",
        "shortLabel": "Arthritis",
        "denominatorLabel": "usual residents",
        "category": "health",
        "mapLayer": True,
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with "
            "arthritis by a doctor or nurse."
        ),
        "definition": (
            'Usual residents reporting "Arthritis" as a long-term health condition in the 2021 '
            "Census, out of all usual residents."
        ),
        "caveats": [
            "A Census-reported long-term condition, not a clinical "
            "prevalence estimate.",
            "Not age-standardised: towns with older populations will tend to show higher rates.",
            "Respondents could mark more than one long-term health condition, so this is not "
            "mutually exclusive with the other Census health indicators.",
            SMALL_DENOMINATOR_CAVEAT,
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "mental_health_pct": {
        "label": "Census-reported mental health condition",
        "shortLabel": "Mental health",
        "denominatorLabel": "usual residents",
        "category": "health",
        "mapLayer": True,
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with a "
            "mental health condition by a doctor or nurse."
        ),
        "definition": (
            'Usual residents reporting "Mental health condition (including depression or '
            'anxiety)" as a long-term health condition in the 2021 Census, out of all usual '
            "residents."
        ),
        "caveats": [
            "A Census-reported long-term condition that includes depression or anxiety; not a "
            "clinical prevalence estimate.",
            "Does not identify the specific mental health condition or its severity.",
            "Respondents could mark more than one long-term health condition, so this is not "
            "mutually exclusive with the other Census health indicators.",
            "Not age-standardised: differences in age structure affect comparisons.",
            SMALL_DENOMINATOR_CAVEAT,
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "heart_disease_pct": {
        "label": "Census-reported heart disease",
        "shortLabel": "Heart disease",
        "denominatorLabel": "usual residents",
        "category": "health",
        "mapLayer": True,
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with heart "
            "disease by a doctor or nurse."
        ),
        "definition": (
            'Usual residents reporting "Heart disease (including heart attack or angina)" as a '
            "long-term health condition in the 2021 Census, out of all usual residents."
        ),
        "caveats": [
            "A Census-reported long-term condition that includes heart attack or angina; not a "
            "clinical prevalence estimate.",
            "Not age-standardised: towns with older populations will tend to show higher rates.",
            "Respondents could mark more than one long-term health condition, so this is not "
            "mutually exclusive with the other Census health indicators.",
            SMALL_DENOMINATOR_CAVEAT,
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "lung_condition_pct": {
        "label": "Census-reported lung condition",
        "shortLabel": "Lung condition",
        "denominatorLabel": "usual residents",
        "category": "health",
        "mapLayer": True,
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with a lung "
            "condition by a doctor or nurse."
        ),
        "definition": (
            'Usual residents reporting "Lung condition (including COPD or emphysema)" as a '
            "long-term health condition in the 2021 Census, out of all usual residents."
        ),
        "caveats": [
            "A Census-reported long-term condition that includes COPD or emphysema; not a "
            "clinical prevalence estimate.",
            "Not age-standardised: towns with older populations will tend to show higher rates.",
            "Respondents could mark more than one long-term health condition, so this is not "
            "mutually exclusive with the other Census health indicators.",
            SMALL_DENOMINATOR_CAVEAT,
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "kidney_disease_pct": {
        "label": "Census-reported kidney disease",
        "shortLabel": "Kidney disease",
        "denominatorLabel": "usual residents",
        "category": "health",
        "mapLayer": True,
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with kidney "
            "disease by a doctor or nurse."
        ),
        "definition": (
            'Usual residents reporting "Kidney disease" as a long-term health condition in the '
            "2021 Census, out of all usual residents."
        ),
        "caveats": [
            "A Census-reported long-term condition, not a clinical "
            "prevalence estimate.",
            "Respondents could mark more than one long-term health condition, so this is not "
            "mutually exclusive with the other Census health indicators.",
            "Not age-standardised: differences in age structure affect comparisons.",
            SMALL_DENOMINATOR_CAVEAT,
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "stroke_pct": {
        "label": "Census-reported stroke",
        "shortLabel": "Stroke",
        "denominatorLabel": "usual residents",
        "category": "health",
        "mapLayer": True,
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with stroke "
            "by a doctor or nurse."
        ),
        "definition": (
            'Usual residents reporting "Stroke" as a long-term health condition in the 2021 '
            "Census, out of all usual residents."
        ),
        "caveats": [
            "A Census-reported long-term condition, not a clinical "
            "prevalence estimate.",
            "Not age-standardised: towns with older populations will tend to show higher rates.",
            "Respondents could mark more than one long-term health condition, so this is not "
            "mutually exclusive with the other Census health indicators.",
            SMALL_DENOMINATOR_CAVEAT,
        ],
        "source": ABS_CENSUS_SOURCE,
    },
    "dementia_pct": {
        "label": "Census-reported dementia",
        "shortLabel": "Dementia",
        "denominatorLabel": "usual residents",
        "category": "health",
        "mapLayer": True,
        "isDefaultMapLayer": False,
        "colorScale": "sequential",
        "description": (
            "Share of usual residents who told the Census they have been diagnosed with "
            "dementia by a doctor or nurse."
        ),
        "definition": (
            'Usual residents reporting "Dementia (including Alzheimer\'s)" as a long-term health '
            "condition in the 2021 Census, out of all usual residents."
        ),
        "caveats": [
            "A Census-reported long-term condition that includes Alzheimer's; not a clinically "
            "diagnosed or measured prevalence estimate.",
            "Not age-standardised: towns with older populations will tend to show higher rates, "
            "and dementia is strongly age-related.",
            "Respondents could mark more than one long-term health condition, so this is not "
            "mutually exclusive with the other Census health indicators.",
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

# PHIDU hospital-services context (scripts/build_phidu_context.py). Deliberately not in INDICATORS:
# these are Population Health Area estimates allocated to towns. No town distributions or
# allocated counts. Separate SR-only map layers and panel context read hospital_context.json.
PHIDU_ATTRIBUTION = "Public Health Information Development Unit (PHIDU), Torrens University Australia"
HOSPITAL_CONTEXT = {
    "public_admissions": {
        "label": "Public hospital admissions",
        "period": "2022/23",
        "definition": (
            "All admissions to public hospitals of residents of the area, excluding same-day "
            "admissions for renal dialysis. Repeat admissions and transfers count separately."
        ),
    },
    "pph": {
        "label": "Potentially preventable hospitalisations",
        "period": "2020/21",
        "definition": (
            "Public hospital admissions for conditions where earlier primary or community care "
            "might have prevented the admission (vaccine-preventable, acute and chronic "
            "conditions; National Healthcare Agreement PI 18)."
        ),
    },
}
HOSPITAL_CONTEXT_CAVEATS = [
    "Estimates for the wider Population Health Area, assigned to towns by PHIDU in proportion to "
    "population. They are not hospital records for this town.",
    "Standardised ratios compare the area with Australia (= 100) after allowing for age "
    "(indirect standardisation). They give a guide to whether the area's rate is, for example, "
    "about twice or half the national rate, not a precise town figure.",
    "PHIDU advises extra care where a town has a larger share of Aboriginal and Torres Strait "
    "Islander residents than the wider area it draws from.",
    "Public hospitals only, counted by where patients live. Hospital data scope differs between "
    "states and territories, so comparisons across state borders need care.",
]
HOSPITAL_CONTEXT_STATUS_TEXT = {
    "suppressed": "Not published for this area: PHIDU suppresses small numbers.",
    "not_available": "Not available from PHIDU for this area.",
    "not_interpretable": (
        "Not shown: the source lists zero for every hospital and emergency department measure for "
        "this town, the same pattern as records with no residents, so it most likely means no data "
        "were assigned rather than no admissions."
    ),
}

# All towns uses a neutral colour; point area encodes population on every layer.
DEFAULT_MAP_LAYER = "all_towns"
