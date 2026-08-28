"""Unit + API tests. Stdlib unittest, so ``python -m unittest`` is enough.

Run from the project root:  python -m unittest discover -s tests -v
"""

from __future__ import annotations

import datetime as dt
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sskreceipts import config, create_app, stats                # noqa: E402
from sskreceipts.storage import Database, is_postgres_url        # noqa: E402
from sskreceipts.money import MoneyError, format_major, parse_amount  # noqa: E402
from sskreceipts.validation import FieldError, clean_name, group_key, parse_date  # noqa: E402


class MoneyTests(unittest.TestCase):
    def test_parses_common_shapes(self):
        self.assertEqual(parse_amount("1,234.50"), 123450)
        self.assertEqual(parse_amount("₱ 99.99"), 9999)
        self.assertEqual(parse_amount(1250), 125000)
        self.assertEqual(parse_amount("0.05"), 5)

    def test_rejects_bad_amounts(self):
        for bad in ("", "abc", "0", "-5", "1.234", None, True, "1e99"):
            with self.subTest(bad=bad), self.assertRaises(MoneyError):
                parse_amount(bad)

    def test_totals_are_exact(self):
        """The reason amounts are integers: 0.1 + 0.2 must be 0.30, not 0.30000000000000004."""
        cents = [parse_amount("0.10"), parse_amount("0.20")]
        self.assertEqual(format_major(sum(cents)), "0.30")


class ValidationTests(unittest.TestCase):
    def test_name_is_normalised(self):
        self.assertEqual(clean_name("  Meralco   Electric \n bill "), "Meralco Electric bill")

    def test_names_group_case_insensitively(self):
        self.assertEqual(group_key("MERALCO  Electric"), group_key("meralco electric"))

    def test_rejects_empty_and_overlong_names(self):
        with self.assertRaises(FieldError):
            clean_name("   ")
        with self.assertRaises(FieldError):
            clean_name("x" * 121)

    def test_date_bounds(self):
        self.assertEqual(parse_date("2026-08-01"), dt.date(2026, 8, 1))
        for bad in ("", "2026-13-01", "01/08/2026", "1999-12-31"):
            with self.subTest(bad=bad), self.assertRaises(FieldError):
                parse_date(bad)


class StatsTests(unittest.TestCase):
    def rows(self):
        return [
            {"name": "Produce", "group_key": "produce", "amount_minor": 10000, "date": "2026-08-01"},
            {"name": "Produce", "group_key": "produce", "amount_minor": 5000, "date": "2026-08-05"},
            {"name": "Rent", "group_key": "rent", "amount_minor": 50000, "date": "2026-08-03"},
        ]

    def test_summary_totals(self):
        s = stats.summarise(self.rows(), dt.date(2026, 8, 1), dt.date(2026, 8, 10))
        self.assertEqual(s["total"], 650.0)
        self.assertEqual(s["count"], 3)
        self.assertEqual(s["top_area"]["name"], "Rent")
        self.assertEqual(s["top_area"]["share"], 76.9)
        self.assertEqual(s["largest_receipt"]["total"], 500.0)

    def test_series_zero_fills_gaps(self):
        s = stats.summarise(self.rows(), dt.date(2026, 8, 1), dt.date(2026, 8, 5))
        points = s["series"]["points"]
        self.assertEqual(s["series"]["granularity"], "day")
        self.assertEqual(len(points), 5)
        self.assertEqual([p["total"] for p in points], [100.0, 0.0, 500.0, 0.0, 50.0])

    def test_granularity_follows_span(self):
        self.assertEqual(stats.choose_granularity(dt.date(2026, 8, 1), dt.date(2026, 8, 31)), "day")
        self.assertEqual(stats.choose_granularity(dt.date(2026, 6, 1), dt.date(2026, 8, 31)), "week")
        self.assertEqual(stats.choose_granularity(dt.date(2026, 1, 1), dt.date(2026, 12, 31)), "month")

    def test_change_against_previous_period(self):
        s = stats.summarise(self.rows(), dt.date(2026, 8, 1), dt.date(2026, 8, 10),
                            previous_total_minor=32500)
        self.assertEqual(s["change_pct"], 100.0)
        # No baseline must not become a division by zero or a fake percentage.
        self.assertIsNone(stats.summarise(self.rows(), dt.date(2026, 8, 1), dt.date(2026, 8, 10),
                                          previous_total_minor=0)["change_pct"])

    def test_previous_period_is_the_same_length(self):
        start, end = stats.previous_period(dt.date(2026, 8, 1), dt.date(2026, 8, 31))
        self.assertEqual((start, end), (dt.date(2026, 7, 1), dt.date(2026, 7, 31)))

    def test_tail_folds_into_other(self):
        areas = [{"name": f"A{i}", "key": str(i), "total": 10.0, "count": 1,
                  "share": 5.0, "last_date": "2026-08-01"} for i in range(11)]
        folded = stats.fold_tail(areas, limit=8)
        self.assertEqual(len(folded), 9)
        self.assertTrue(folded[-1]["is_other"])
        self.assertEqual(folded[-1]["count"], 3)
        self.assertEqual(folded[-1]["total"], 30.0)


class StorageTests(unittest.TestCase):
    def test_postgres_urls_are_recognised(self):
        for url in ("postgres://h/db", "postgresql://u:p@h:5432/db", "postgresql+psycopg://h/db"):
            self.assertTrue(is_postgres_url(url), url)
        for url in ("sqlite:///x.db", "/var/lib/receipts.sqlite3", "", None):
            self.assertFalse(is_postgres_url(url), url)

    def test_placeholders_are_translated_for_postgres(self):
        """One copy of every statement; the dialect decides the placeholder."""
        query = "SELECT * FROM receipts WHERE date >= ? AND date <= ?"
        self.assertEqual(Database(None, "sqlite")._sql(query), query)
        self.assertEqual(
            Database(None, "postgres")._sql(query),
            "SELECT * FROM receipts WHERE date >= %s AND date <= %s",
        )


class ServerlessGuardTests(unittest.TestCase):
    """A serverless host with no Postgres silently loses every receipt."""

    def setUp(self):
        self._saved = {k: os.environ.get(k) for k in
                       ("VERCEL", "SSK_ALLOW_EPHEMERAL_DB", *config.URL_ENV_VARS)}
        for key in self._saved:
            os.environ.pop(key, None)

    def tearDown(self):
        for key, value in self._saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def test_serverless_without_a_database_is_refused(self):
        os.environ["VERCEL"] = "1"
        with self.assertRaises(config.ConfigError) as caught:
            config.build("/tmp/instance")
        self.assertIn("DATABASE_URL", str(caught.exception))

    def test_serverless_with_a_database_is_fine(self):
        os.environ["VERCEL"] = "1"
        os.environ["DATABASE_URL"] = "postgresql://user:pw@example.test/ssk"
        built = config.build("/tmp/instance")
        self.assertEqual(built["DATABASE_URL"], "postgresql://user:pw@example.test/ssk")

    def test_override_allows_a_throwaway_demo(self):
        os.environ["VERCEL"] = "1"
        os.environ["SSK_ALLOW_EPHEMERAL_DB"] = "1"
        self.assertIsNone(config.build("/tmp/instance")["DATABASE_URL"])

    def test_local_runs_need_no_database_url(self):
        self.assertIsNone(config.build("/tmp/instance")["DATABASE_URL"])


class ApiTests(unittest.TestCase):
    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".sqlite3")
        os.close(fd)
        self.app = create_app({"DATABASE": self.path, "TESTING": True})
        self.client = self.app.test_client()

    def tearDown(self):
        for suffix in ("", "-wal", "-shm"):
            try:
                os.remove(self.path + suffix)
            except OSError:
                pass

    def add(self, name="Produce", amount="100.50", date="2026-08-10"):
        return self.client.post("/api/receipts",
                                json={"name": name, "amount": amount, "date": date})

    def test_create_read_update_delete(self):
        created = self.add()
        self.assertEqual(created.status_code, 201)
        receipt_id = created.get_json()["receipt"]["id"]
        self.assertEqual(created.get_json()["receipt"]["amount"], 100.5)

        board = self.client.get("/api/dashboard?start=2026-08-01&end=2026-08-31").get_json()
        self.assertEqual(board["summary"]["total"], 100.5)
        self.assertEqual(board["summary"]["top_area"]["name"], "Produce")

        updated = self.client.put(f"/api/receipts/{receipt_id}",
                                  json={"name": "Rent", "amount": "200", "date": "2026-08-11"})
        self.assertEqual(updated.get_json()["receipt"]["amount"], 200.0)

        self.assertEqual(self.client.delete(f"/api/receipts/{receipt_id}").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/receipts/{receipt_id}").status_code, 404)

    def test_validation_errors_name_the_field(self):
        cases = [
            ({"name": "", "amount": "10", "date": "2026-08-10"}, "name"),
            ({"name": "X", "amount": "-1", "date": "2026-08-10"}, "amount"),
            ({"name": "X", "amount": "10", "date": "nope"}, "date"),
        ]
        for payload, field in cases:
            with self.subTest(field=field):
                response = self.client.post("/api/receipts", json=payload)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["field"], field)

    def test_range_filter_excludes_outside_receipts(self):
        self.add(date="2026-07-15", amount="10")
        self.add(date="2026-08-15", amount="20")
        board = self.client.get("/api/dashboard?start=2026-08-01&end=2026-08-31").get_json()
        self.assertEqual(len(board["receipts"]), 1)
        self.assertEqual(board["summary"]["total"], 20.0)
        # The previous 31 days pick up the July receipt, giving a real comparison.
        self.assertEqual(board["summary"]["previous_total"], 10.0)

    def test_areas_group_by_name_case_insensitively(self):
        self.add(name="Fresh Produce", amount="100", date="2026-08-01")
        self.add(name="fresh  produce", amount="50", date="2026-08-02")
        summary = self.client.get("/api/dashboard?start=2026-08-01&end=2026-08-31").get_json()["summary"]
        self.assertEqual(len(summary["areas"]), 1)
        self.assertEqual(summary["areas"][0]["total"], 150.0)
        self.assertEqual(summary["areas"][0]["count"], 2)
        # The label follows the spelling on the most recent receipt.
        self.assertEqual(summary["areas"][0]["name"], "fresh produce")

    def test_invalid_range_is_rejected(self):
        response = self.client.get("/api/dashboard?start=2026-08-31&end=2026-08-01")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["field"], "start")

    def test_csv_export(self):
        self.add(name="Produce", amount="100.50", date="2026-08-10")
        self.add(name="Rent", amount="1000", date="2026-08-11")
        response = self.client.get("/api/export.csv?start=2026-08-01&end=2026-08-31")
        self.assertEqual(response.status_code, 200)
        body = response.get_data(as_text=True)
        self.assertIn("Produce,100.50", body)
        self.assertIn("Total,,1100.50", body)
        self.assertIn("attachment", response.headers["Content-Disposition"])

    def test_empty_range_still_renders(self):
        board = self.client.get("/api/dashboard?start=2026-08-01&end=2026-08-31").get_json()
        self.assertEqual(board["summary"]["total"], 0)
        self.assertIsNone(board["summary"]["top_area"])
        self.assertEqual(board["summary"]["average"], 0.0)

    def test_index_and_health(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertTrue(self.client.get("/healthz").get_json()["ok"])


if __name__ == "__main__":
    unittest.main()
