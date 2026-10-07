"""Build the Atlas UCL analytic dataset from the canonical PHIDU/John Glover master workbook.

The published Zenodo dataset (10.5281/zenodo.22783233) covers the diabetes paper's sample: UCLs
with at least 200 usual residents. The Atlas product uses a lower bound of 100 usual residents,
so this script rebuilds the Atlas dataset from the canonical master workbook, applying the same
logic as the paper's pipeline (Diabetology `Data/Scripts/import_census.py` and
`build_remoteness.py`):

  - UCL identity: the workbook's UCL code and name, unmodified.
  - Special/non-settlement records excluded by name: "Remainder of State/Territory",
    "Migratory - Offshore - Shipping" and "No usual address" (27 records). Their reserved codes
    (x31001, x79997, x99994) are cross-checked against the name rule.
  - 2021 Remoteness Area from the official ABS SA1-to-RA and SA1-to-UCL allocation files. A UCL
    must lie wholly within one Remoteness Area; anything else stops the build.
  - Indicator counts/denominators from the same workbook columns as the published dataset.

Verification: restricted to population >= 200, the output must reproduce the 1,743 published
Zenodo UCLs exactly (same codes, population, counts, denominators, state and Remoteness Area).

Inputs (read-only):
  05_source_archive/PHIDU_John_Glover/2026-09-23_final_delivery/_data_workbook-witth_details.xlsx
  05_source_archive/ABS_geography/2021_ASGS_inputs/RA_2021_AUST.xlsx
  05_source_archive/ABS_geography/2021_ASGS_inputs/UCL_SOSR_SOS_2021_AUST.xlsx
  01_public_source/zenodo/diabetes_ucl_analytic_dataset.csv   (verification only)

Outputs:
  06_derived_data/census/atlas_ucl_dataset.csv              every settlement UCL with >= 100 residents
  06_derived_data/census/atlas_ucl_dataset_exclusions.csv   every workbook UCL not in the output, with reason
  06_derived_data/census/atlas_ucl_dataset_provenance.json  source hashes, rules and check results

Run first: build_analytic.py -> build_geometry.py -> build_data.py -> validate.py
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import openpyxl
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
MASTER_WORKBOOK = (
    ROOT
    / "05_source_archive"
    / "PHIDU_John_Glover"
    / "2026-09-23_final_delivery"
    / "_data_workbook-witth_details.xlsx"
)
ABS_DIR = ROOT / "05_source_archive" / "ABS_geography" / "2021_ASGS_inputs"
RA_FILE = ABS_DIR / "RA_2021_AUST.xlsx"
UCL_SA1_FILE = ABS_DIR / "UCL_SOSR_SOS_2021_AUST.xlsx"
ZENODO_CSV = ROOT / "01_public_source" / "zenodo" / "diabetes_ucl_analytic_dataset.csv"
OUT_DIR = ROOT / "06_derived_data" / "census"
OUT_CSV = OUT_DIR / "atlas_ucl_dataset.csv"
OUT_EXCLUSIONS = OUT_DIR / "atlas_ucl_dataset_exclusions.csv"
OUT_PROVENANCE = OUT_DIR / "atlas_ucl_dataset_provenance.json"

EXPECTED_MASTER_UCLS = 1836
EXPECTED_SPECIAL_RECORDS = 27
ATLAS_MIN_POP = 100  # Atlas product lower bound (the diabetes paper used 200)
PAPER_MIN_POP = 200

SPECIAL_NAME = re.compile(r"Remainder|Migratory|No usual address", re.IGNORECASE)
SPECIAL_CODE = re.compile(r"^UCL\d(31001|79997|99994)$")

REMOTENESS_ORDER = [
    "Major Cities of Australia",
    "Inner Regional Australia",
    "Outer Regional Australia",
    "Remote Australia",
    "Very Remote Australia",
]

# Workbook column (0-based) and its expected header label (row 2). Labels are checked so a
# re-laid-out workbook fails loudly instead of silently reading the wrong column.
POPULATION_COLUMN = (4, "Tot_P_P")

# Atlas indicator stem -> (numerator columns summed, denominator column).
INDICATOR_COLUMNS: dict[str, tuple[list[tuple[int, str]], tuple[int, str]]] = {
    "diabetes": ([(24, "P_Diabetes_Tot")], (25, "Tot_P_P")),
    "indigenous": ([(449, "Indigenous population")], (450, "Tot_P_P")),
    "degree": (
        [
            (200, "Postgraduate Degree Level"),
            (204, "Graduate Diploma and Graduate Certificate Level"),
            (208, "Bachelor Degree Level"),
        ],
        (201, "Tot_P_P"),
    ),
    "low_income": (
        [
            (257, "Nil income"),
            (261, "$1-$149 ($1-$7,799)"),
            (265, "$150-$299 ($7,800-$15,599)"),
            (269, "$300-$399 ($15,600-$20,799)"),
            (273, "$400-$499 ($20,800-$25,999)"),
            (277, "$500-$649 ($26,000-$33,799)"),
        ],
        (258, "All households"),
    ),
    "unemployed_residents": ([(241, "Unemployed")], (242, "Tot_P_P")),
    "labour_force_residents": ([(253, "Labour force participation")], (254, "Tot_P_P")),
    "crowded": ([(321, "People living in crowded dwellings")], (322, "Tot_P_P")),
    "social_housing": ([(345, "Social housing (people in rented dwellings)")], (346, "Tot_P_P")),
    "need_assistance": ([(445, "Has need for assistance with core activities")], (446, "Tot_P_P")),
    "born_overseas_nes": (
        [(184, "Born overseas - in predominantly non-English-speaking (NES) countries")],
        (185, "Tot_P_P"),
    ),
}

OUTPUT_COLUMNS = [
    "ucl_code",
    "ucl_name",
    "state_code",
    "state_name",
    "remoteness_code",
    "remoteness_name",
    "population",
    "in_published_sample",
] + [f"{stem}_{part}" for stem in INDICATOR_COLUMNS for part in ("count", "denominator", "pct")]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_master() -> tuple[tuple[object, ...], dict[str, tuple[object, ...]]]:
    workbook = openpyxl.load_workbook(MASTER_WORKBOOK, read_only=True, data_only=True)
    try:
        rows = workbook["data"].iter_rows(values_only=True)
        next(rows)
        header = next(rows)
        records: dict[str, tuple[object, ...]] = {}
        for row in rows:
            code = row[0]
            if isinstance(code, str) and code.startswith("UCL"):
                if code in records:
                    raise SystemExit(f"Duplicate UCL code in master workbook: {code}")
                records[code] = tuple(row)
    finally:
        workbook.close()
    if len(records) != EXPECTED_MASTER_UCLS:
        raise SystemExit(f"Master workbook has {len(records)} UCL rows; expected {EXPECTED_MASTER_UCLS}")
    return header, records


def check_headers(header: tuple[object, ...]) -> None:
    expected = [POPULATION_COLUMN]
    for numerators, denominator in INDICATOR_COLUMNS.values():
        expected.extend(numerators)
        expected.append(denominator)
    for column, label in expected:
        actual = str(header[column] or "").strip()
        if actual != label:
            raise SystemExit(f"Workbook column {column}: expected header {label!r}, found {actual!r}")


def as_int(value: object, code: str, column: int) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or float(value) != int(value):
        raise SystemExit(f"{code}: workbook column {column} is not a whole count ({value!r})")
    return int(value)


def extract_counts(code: str, row: tuple[object, ...]) -> dict[str, int]:
    out = {"population": as_int(row[POPULATION_COLUMN[0]], code, POPULATION_COLUMN[0])}
    for stem, (numerators, (den_col, _)) in INDICATOR_COLUMNS.items():
        out[f"{stem}_count"] = sum(as_int(row[c], code, c) for c, _ in numerators)
        out[f"{stem}_denominator"] = as_int(row[den_col], code, den_col)
    return out


def read_geography() -> pd.DataFrame:
    """One row per UCL: its sets of 2021 Remoteness Areas and states, from SA1 allocations."""
    ra = pd.read_excel(RA_FILE, dtype={"SA1_CODE_2021": str})
    ucl = pd.read_excel(UCL_SA1_FILE, dtype={"SA1_CODE_2021": str, "UCL_CODE_2021": str})
    merged = ucl.merge(ra[["SA1_CODE_2021", "RA_NAME_2021"]], on="SA1_CODE_2021", how="left")
    if merged["RA_NAME_2021"].isnull().any():
        raise SystemExit("Some SA1s in the UCL allocation have no Remoteness Area allocation")
    merged["ucl_code"] = "UCL" + merged["UCL_CODE_2021"]
    return merged.groupby("ucl_code").agg(
        remoteness_names=("RA_NAME_2021", lambda s: sorted(set(s))),
        state_codes=("STATE_CODE_2021", lambda s: sorted(set(str(v) for v in s))),
        state_names=("STATE_NAME_2021", lambda s: sorted(set(s))),
    )


def assign_geography(code: str, geo: pd.DataFrame) -> dict[str, object]:
    if code not in geo.index:
        raise SystemExit(f"{code} not found in the ABS SA1-to-UCL allocation")
    entry = geo.loc[code]
    if len(entry["remoteness_names"]) != 1:
        raise SystemExit(f"{code} spans several Remoteness Areas {entry['remoteness_names']}")
    if len(entry["state_codes"]) != 1:
        raise SystemExit(f"{code} spans several states {entry['state_names']}")
    remoteness_name = entry["remoteness_names"][0]
    if remoteness_name not in REMOTENESS_ORDER:
        raise SystemExit(f"{code} has non-standard Remoteness Area {remoteness_name!r}")
    return {
        "state_code": int(entry["state_codes"][0]),
        "state_name": entry["state_names"][0],
        "remoteness_code": REMOTENESS_ORDER.index(remoteness_name) + 1,
        "remoteness_name": remoteness_name,
    }


def verify_against_zenodo(out: pd.DataFrame) -> int:
    zenodo = pd.read_csv(ZENODO_CSV).set_index("ucl_code")
    paper = out[out["population"] >= PAPER_MIN_POP].set_index("ucl_code")
    problems: list[str] = []
    if set(paper.index) != set(zenodo.index):
        problems.append(
            f"code sets differ: {len(set(paper.index) - set(zenodo.index))} extra, "
            f"{len(set(zenodo.index) - set(paper.index))} missing"
        )
    else:
        exact = ["population", "state_code", "state_name", "remoteness_code", "remoteness_name"]
        exact += [f"{s}_{p}" for s in INDICATOR_COLUMNS for p in ("count", "denominator")]
        for col in exact:
            diff = paper[col] != zenodo.loc[paper.index, col]
            problems += [f"{c}.{col}" for c in paper.index[diff]]
        for stem in INDICATOR_COLUMNS:
            col = f"{stem}_pct"
            gap = (paper[col] - zenodo.loc[paper.index, col]).abs().max()
            if not gap <= 1e-9:
                problems.append(f"{col}: max abs difference {gap}")
    if problems:
        raise SystemExit(
            f"Pipeline does not reproduce the published Zenodo dataset ({len(problems)} problems): "
            + "; ".join(problems[:10])
        )
    return len(zenodo)


def main() -> None:
    header, master = read_master()
    check_headers(header)
    geo = read_geography()

    rows: list[dict[str, object]] = []
    exclusions: list[dict[str, object]] = []
    for code, row in master.items():
        name = str(row[1])
        counts = extract_counts(code, row)
        special_by_name = bool(SPECIAL_NAME.search(name))
        if special_by_name != bool(SPECIAL_CODE.match(code)):
            raise SystemExit(f"{code} {name!r}: special-record name and code rules disagree")
        if special_by_name:
            exclusions.append(
                {"ucl_code": code, "ucl_name": name, "population": counts["population"],
                 "exclusion": "Non-settlement/special code"}
            )
            continue
        if counts["population"] < ATLAS_MIN_POP:
            exclusions.append(
                {"ucl_code": code, "ucl_name": name, "population": counts["population"],
                 "exclusion": f"Population below {ATLAS_MIN_POP}"}
            )
            continue
        rec: dict[str, object] = {
            "ucl_code": code,
            "ucl_name": name,
            **assign_geography(code, geo),
            "population": counts["population"],
            "in_published_sample": counts["population"] >= PAPER_MIN_POP,
        }
        for stem in INDICATOR_COLUMNS:
            num, den = counts[f"{stem}_count"], counts[f"{stem}_denominator"]
            if den <= 0 or not 0 <= num <= den:
                raise SystemExit(f"{code} {name}: {stem} count {num} / denominator {den} is not usable")
            rec[f"{stem}_count"] = num
            rec[f"{stem}_denominator"] = den
            rec[f"{stem}_pct"] = 100 * num / den
        rows.append(rec)

    special_n = sum(e["exclusion"] == "Non-settlement/special code" for e in exclusions)
    if special_n != EXPECTED_SPECIAL_RECORDS:
        raise SystemExit(f"Found {special_n} special records; expected {EXPECTED_SPECIAL_RECORDS}")

    out = pd.DataFrame(rows, columns=OUTPUT_COLUMNS).sort_values("ucl_code")
    verified = verify_against_zenodo(out)
    added = out[out["population"] < PAPER_MIN_POP]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT_CSV, index=False)
    pd.DataFrame(exclusions).sort_values("ucl_code").to_csv(OUT_EXCLUSIONS, index=False)

    provenance = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "script": "04_site/scripts/build_analytic.py",
        "atlasMinPopulation": ATLAS_MIN_POP,
        "paperMinPopulation": PAPER_MIN_POP,
        "note": (
            f"The Atlas uses a {ATLAS_MIN_POP}-resident lower bound as a product definition. The "
            f"published diabetes paper and Zenodo dataset used {PAPER_MIN_POP}. Neither is an ABS "
            "definition of a town."
        ),
        "sources": [
            {"path": str(p.relative_to(ROOT)).replace("\\", "/"), "sha256": sha256(p)}
            for p in (MASTER_WORKBOOK, RA_FILE, UCL_SA1_FILE, ZENODO_CSV)
        ],
        "rules": {
            "specialRecords": "name matches /Remainder|Migratory|No usual address/i (cross-checked against codes x31001/x79997/x99994)",
            "remoteness": "UCL must lie wholly within one 2021 Remoteness Area (ABS SA1 allocation)",
        },
        "counts": {
            "masterWorkbookUcls": len(master),
            "specialRecordsExcluded": special_n,
            f"settlementsBelow{ATLAS_MIN_POP}Excluded": len(exclusions) - special_n,
            "outputRows": len(out),
            f"addedPopulation{ATLAS_MIN_POP}to{PAPER_MIN_POP - 1}": len(added),
            "zenodoRowsReproducedExactly": verified,
        },
    }
    OUT_PROVENANCE.write_text(json.dumps(provenance, indent=2), encoding="utf-8")

    print(f"Master workbook UCLs: {len(master)}")
    print(f"Special/non-settlement records excluded: {special_n}")
    print(f"Settlements below {ATLAS_MIN_POP} excluded: {len(exclusions) - special_n}")
    print(f"Published Zenodo rows reproduced exactly: {verified}")
    print(f"Added settlements with population {ATLAS_MIN_POP}-{PAPER_MIN_POP - 1}: {len(added)}")
    print(f"Wrote {len(out)} rows to {OUT_CSV}")


if __name__ == "__main__":
    main()
