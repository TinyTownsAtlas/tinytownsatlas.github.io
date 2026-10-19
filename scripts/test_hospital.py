"""Hospital source symbol handling: unavailable is never observed zero."""
import unittest
from build_phidu_context import parse_value

class HospitalStatus(unittest.TestCase):
    def test_missing_symbols_are_null_statuses(self):
        for raw,status in [("#","suppressed"),("..","suppressed"),("n.a.","not_available")]:
            self.assertEqual(parse_value(raw,"UCL121013",4,False),(None,status))
    def test_all_zero_row_is_uninterpretable(self):
        self.assertEqual(parse_value(0,"UCL822002",4,True),(None,"not_interpretable"))
    def test_unexpected_zero_unknown_symbol_and_invalid_numbers_fail(self):
        for raw in [0,-1,float("nan"),float("inf"),True,"?",None]:
            with self.subTest(raw=raw):
                with self.assertRaises(SystemExit):parse_value(raw,"UCL121013",4,False)
    def test_ratio_is_not_an_allocated_count(self):
        self.assertEqual(parse_value(156.6,"UCL121013",4,False),(156.6,"available"))

if __name__=="__main__":unittest.main()
