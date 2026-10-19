"""Build public/data/assistant_index.json for the "Ask Tiny Towns Atlas" Worker.

Derived only from the other public files in public/data (towns, indicators, hospital context,
Ten4Ten tags, manifest); it reads no private or source-archive files, so it can be rebuilt with
`python scripts/build_assistant_index.py` after build_data.py. build_data.py also calls build().

The Worker runs deterministic queries over this file. Nothing here is a ranking, score or index;
hospital values stay as the PHA-derived SR with their status, and no allocated counts are included.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "public" / "data"
SITE_URL = "https://tinytownsatlas.github.io/"
INDEX_VERSION = 1

STATE_ABBR = {
    "New South Wales": "NSW",
    "Victoria": "VIC",
    "Queensland": "QLD",
    "South Australia": "SA",
    "Western Australia": "WA",
    "Tasmania": "TAS",
    "Northern Territory": "NT",
    "Australian Capital Territory": "ACT",
    "Other Territories": "OT",
}
HOSPITAL_LAYER_KEYS = ["public_admissions", "pph"]
REMOTENESS_LAYER_KEY = "remoteness_name"

# Fields copied from indicators.json (definitions are never re-written here).
INDICATOR_FIELDS = [
    "key", "label", "shortLabel", "unit", "category", "mapLayer", "numeratorField", "denominatorField",
    "denominatorLabel", "description", "definition", "caveats", "source", "nationalStats", "remotenessStats",
]


def read(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def display_name(ucl_name: str) -> str:
    """'Laura (L) (Qld)' -> 'Laura'; the full ucl_name is kept alongside it."""
    return re.sub(r"\s*\([^)]*\)", "", ucl_name).strip()


def build() -> dict:
    towns = read("towns.json")
    indicators = read("indicators.json")
    hospital = read("hospital_context.json")
    ten4ten = read("ten4ten.json")
    manifest = read("manifest.json")

    ind_keys = list(indicators)
    out_towns = []
    for t in towns:
        code = t["ucl_code"]
        h = hospital["towns"][code]
        entry = {
            "code": code,
            "name": t["ucl_name"],
            "display": display_name(t["ucl_name"]),
            "state": STATE_ABBR[t["state_name"]],
            "stateName": t["state_name"],
            "pop": t["population"],
            "remoteness": t["remoteness_name"],
            "ten4ten": code in ten4ten["uclCodes"],
            "alias": ten4ten["communityLabels"].get(code),
            "ind": {
                k: [t[k], t[k.replace("_pct", "_count")], t[k.replace("_pct", "_denominator")]] for k in ind_keys
            },
            "hosp": {
                "phaCode": h["phaCode"],
                "phaName": h["phaName"],
                **{k: {"status": v["status"], "sr": v["sr"]} for k, v in h["values"].items()},
            },
        }
        out_towns.append(entry)

    return {
        "version": INDEX_VERSION,
        "generatedAt": manifest["generatedAt"],
        "siteUrl": SITE_URL,
        "scope": {
            "definition": manifest["scopeDefinition"],
            "minPopulation": manifest["primaryMinPopulation"],
            "maxPopulation": manifest["primaryMaxPopulation"],
            "townCount": manifest["primaryCount"],
        },
        "links": {
            "pattern": "?town={code}&layer={layer}&outcome={outcome}",
            "healthLayerKeys": [k for k, v in indicators.items() if v["category"] == "health" and v["mapLayer"]],
            "hospitalLayerKeys": HOSPITAL_LAYER_KEYS,
            "remotenessLayerKey": REMOTENESS_LAYER_KEY,
            "defaultLayer": manifest["defaultMapLayer"],
        },
        "states": [{"name": n, "abbr": a} for n, a in STATE_ABBR.items()],
        "remotenessOrder": manifest["remotenessOrder"],
        "indicators": {k: {f: v[f] for f in INDICATOR_FIELDS} for k, v in indicators.items()},
        "hospital": {
            "measure": hospital["measure"],
            "indicators": hospital["indicators"],
            "caveats": hospital["caveats"],
            "statusText": hospital["statusText"],
            "licence": {k: hospital["licence"][k] for k in ("name", "url", "attribution")},
        },
        "towns": out_towns,
    }


def main() -> None:
    index = build()
    path = DATA_DIR / "assistant_index.json"
    path.write_text(json.dumps(index, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"assistant_index.json: {len(index['towns'])} towns, {path.stat().st_size / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
