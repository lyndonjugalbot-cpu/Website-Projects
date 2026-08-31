"""Unit tests for name_rules.  Run: python -m unittest -v"""

import unittest

from name_rules import combine_name


class NameTests(unittest.TestCase):
    def test_combine(self):
        self.assertEqual(combine_name("Derek", "Keen"), "Derek Keen")
        self.assertEqual(combine_name("John", "Jargon"), "John Jargon")
        self.assertEqual(combine_name("  John ", " Jargon "), "John Jargon")
        self.assertEqual(combine_name("Cher", ""), "Cher")
        self.assertEqual(combine_name("", "Prince"), "Prince")
        self.assertEqual(combine_name(None, None), "")
        self.assertEqual(combine_name("  ", "  "), "")


if __name__ == "__main__":
    unittest.main()
