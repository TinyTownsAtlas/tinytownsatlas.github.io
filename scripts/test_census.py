"""Source extraction and public-output regression tests. Run after the complete data build.

Workbook columns below are independent verified 0-based anchors, not derived from the extractor.
Baseline hashes freeze the pre-UX2 diabetes/cancer values, metadata and Ten4Ten tags.
"""
import hashlib
import json
import unittest
from pathlib import Path

import build_analytic as build
from indicator_defs import INDICATORS

COLUMNS = {
    "diabetes": (24,"P_Diabetes_Tot",25), "cancer": (16,"P_Cancer_Tot",17),
    "asthma": (12,"P_Asthma_Tot",13), "arthritis": (8,"P_Arthritis_Tot",9),
    "mental_health": (40,"P_Mental_health_cond_Tot",41),
    "heart_disease": (28,"P_Heart_disease_Tot",29),
    "lung_condition": (36,"P_Lung_cond_Tot",37),
    "kidney_disease": (32,"P_Kidney_disease_Tot",33),
    "stroke": (44,"P_Stroke_Tot",45), "dementia": (20,"P_Dementia_Tot",21),
}
BASELINE = {'diabetes': ('fdbc0698d0add72dcd9010ae433e92c3fafaf24d9eb19fb9d6d2d65a5e69938d', '2a1991cc60e7529d51c58bc7f83627e0a1a9ca5ddcc660cf832f9602d7825e63'), 'cancer': ('7a15aa5e04a74318507e22237a5b0ffb8554f24fe24a62d0d19f91db0d399047', 'ac641e0b6f4a446d0b984cdaee61d6ffd7a3495e8b7a6016398a062b17ec32d4'), 'ten4ten': '06e9eea56045cdd6e6d7d43a4007bbf40a72b7f14725aa38d5a07f5478f84701'}
DATA = Path(__file__).resolve().parents[1]/"public"/"data"
def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":")).encode()).hexdigest()

class CensusExtraction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sections, cls.headers, cls.master = build.read_master()

    def test_verified_source_headers_and_block(self):
        build.check_sections(self.sections)
        build.check_headers(self.headers)
        for stem,(num,label,den) in COLUMNS.items():
            self.assertEqual(build.INDICATOR_COLUMNS[stem], ([(num,label)],(den,"Tot_P_P")))
            self.assertEqual(self.headers[num],label)
            self.assertEqual(self.headers[den],"Tot_P_P")

    def test_each_mutated_numerator_and_denominator_header_fails(self):
        for stem,(num,_,den) in COLUMNS.items():
            for column in (num,den):
                with self.subTest(stem=stem,column=column):
                    header=list(self.headers);header[column]="CHANGED"
                    with self.assertRaises(SystemExit):build.check_headers(tuple(header))

    def test_mutated_lthp_label_geography_and_interior_block_fail(self):
        for column,label in [(8,"LTHP moved"),(8,"LTHP Type of Long-term Health Condition 2021 Census - counting persons, place of enumeration"),(20,"New table block")]:
            sections=list(self.sections);sections[column]=label
            with self.assertRaises(SystemExit):build.check_sections(tuple(sections))

    def test_all_source_numerators_denominators_and_public_values(self):
        towns=json.loads((DATA/"towns_full.json").read_text(encoding="utf-8"))
        for town in towns:
            row=self.master[town["ucl_code"]]
            counts=build.extract_counts(town["ucl_code"],row)
            for stem,(num,_,den) in COLUMNS.items():
                self.assertEqual(counts[stem+"_count"],row[num])
                self.assertEqual(counts[stem+"_denominator"],row[den])
                self.assertEqual(town[stem+"_count"],row[num])
                self.assertEqual(town[stem+"_denominator"],row[den])
                self.assertEqual(town[stem+"_pct"],round(100*row[num]/row[den],1))

    def test_diabetes_cancer_and_ten4ten_unchanged(self):
        towns=json.loads((DATA/"towns_full.json").read_text(encoding="utf-8"))
        meta=json.loads((DATA/"indicators.json").read_text(encoding="utf-8"))
        for stem in ("diabetes","cancer"):
            triples={t["ucl_code"]:[t[f"{stem}_{suffix}"] for suffix in ("count","denominator","pct")] for t in towns}
            self.assertEqual(digest(triples),BASELINE[stem][0])
            self.assertEqual(digest(meta[stem+"_pct"]),BASELINE[stem][1])
        self.assertEqual(digest(json.loads((DATA/"ten4ten.json").read_text(encoding="utf-8"))),BASELINE["ten4ten"])

    def test_all_ten_have_scientific_caveats_and_opt_in_maps(self):
        health={k:v for k,v in INDICATORS.items() if v["category"]=="health"}
        self.assertEqual(set(health),{stem+"_pct" for stem in COLUMNS})
        for key,meta in health.items():
            self.assertTrue(meta["mapLayer"])
            self.assertTrue(any("age-standardised" in c for c in meta["caveats"]),key)
            self.assertTrue(any("small denominator" in c for c in meta["caveats"]),key)
            self.assertTrue(meta["definition"])
            self.assertFalse(meta["isDefaultMapLayer"])

if __name__=="__main__":unittest.main()
