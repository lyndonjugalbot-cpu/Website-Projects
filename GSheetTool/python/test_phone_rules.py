"""Unit tests for phone_rules.  Run: python -m unittest -v"""

import unittest

from phone_rules import (
    PhoneParseError,
    combine_name,
    normalise_phone,
    try_normalise_phone,
)


class PhoneScenarioTests(unittest.TestCase):
    def test_brief_scenarios(self):
        self.assertEqual(normalise_phone("'02904343199"), "02904343199")
        self.assertEqual(normalise_phone("'+642904343199"), "02904343199")
        self.assertEqual(normalise_phone("'2904343199"), "02904343199")
        self.assertEqual(normalise_phone("'0290434319"), "0290434319")

    def test_other_common_shapes(self):
        self.assertEqual(normalise_phone("02904343199"), "02904343199")
        self.assertEqual(normalise_phone("2904343199."), "02904343199")
        self.assertEqual(normalise_phone("290434319"), "0290434319")
        self.assertEqual(normalise_phone("  0290 434 3199 "), "02904343199")
        self.assertEqual(normalise_phone("029-0434-3199"), "02904343199")
        self.assertEqual(normalise_phone("0064 2904343199"), "02904343199")
        self.assertEqual(normalise_phone("642904343199"), "02904343199")

    def test_idempotent(self):
        once = normalise_phone("02904343199")
        self.assertEqual(normalise_phone(once), once)
        self.assertEqual(normalise_phone("0290434319"), "0290434319")

    def test_rejects_junk(self):
        for bad in ["", "   ", "abc", "12", None]:
            with self.assertRaises(PhoneParseError):
                normalise_phone(bad)

    def test_try_normalise_status(self):
        self.assertEqual(try_normalise_phone("'02904343199"), ("02904343199", "fixed"))
        self.assertEqual(try_normalise_phone("+642904343199"), ("02904343199", "fixed"))
        self.assertEqual(try_normalise_phone("02904343199"), ("02904343199", "unchanged"))
        self.assertEqual(try_normalise_phone(""), ("", "empty"))
        self.assertEqual(try_normalise_phone("   "), ("   ", "empty"))
        self.assertEqual(try_normalise_phone("not a phone"), ("not a phone", "failed"))


class NameTests(unittest.TestCase):
    def test_combine(self):
        self.assertEqual(combine_name("John", "Jargon"), "John Jargon")
        self.assertEqual(combine_name("  John ", " Jargon "), "John Jargon")
        self.assertEqual(combine_name("Cher", ""), "Cher")
        self.assertEqual(combine_name("", "Prince"), "Prince")
        self.assertEqual(combine_name(None, None), "")
        self.assertEqual(combine_name("  ", "  "), "")


if __name__ == "__main__":
    unittest.main()
