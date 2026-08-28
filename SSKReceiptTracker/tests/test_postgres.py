"""The API and aggregation suite, re-run against a real Postgres.

SQLite is what runs locally; Postgres is what runs on a serverless host. The
two backends share every SQL statement, so the suite that guards the SQLite
path has to pass unchanged against Postgres or the deployed app is untested.

Skipped unless ``TEST_DATABASE_URL`` points at a reachable Postgres, e.g.::

    TEST_DATABASE_URL=postgresql://postgres@/ssk?host=/tmp&port=5433 \
        python -m unittest discover -s tests
"""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sskreceipts import create_app, db  # noqa: E402

TEST_URL = os.environ.get("TEST_DATABASE_URL")


def _reachable(url: str) -> bool:
    try:
        import psycopg
    except ImportError:
        return False
    try:
        psycopg.connect(url, connect_timeout=5).close()
        return True
    except Exception:
        return False


@unittest.skipUnless(TEST_URL and _reachable(TEST_URL), "TEST_DATABASE_URL not set or unreachable")
class PostgresBackendTests(unittest.TestCase):
    """Mirrors tests/test_app.py's API coverage on the other engine."""

    def setUp(self):
        self.app = create_app({"DATABASE_URL": TEST_URL, "DATABASE": ":memory:", "TESTING": True})
        self.client = self.app.test_client()
        with self.app.app_context():
            db.init_db()
            db.get_db().execute("DELETE FROM receipts")
            db.get_db().commit()

    def add(self, name="Produce", amount="100.50", date="2026-08-10"):
        return self.client.post("/api/receipts",
                                json={"name": name, "amount": amount, "date": date})

    def test_it_really_is_postgres(self):
        self.assertEqual(self.client.get("/healthz").get_json()["database"], "postgres")

    def test_create_read_update_delete(self):
        created = self.add()
        self.assertEqual(created.status_code, 201)
        receipt_id = created.get_json()["receipt"]["id"]
        self.assertIsInstance(receipt_id, int)
        self.assertEqual(created.get_json()["receipt"]["amount"], 100.5)

        board = self.client.get("/api/dashboard?start=2026-08-01&end=2026-08-31").get_json()
        self.assertEqual(board["summary"]["total"], 100.5)
        self.assertEqual(board["summary"]["top_area"]["name"], "Produce")
        self.assertEqual(board["receipts"][0]["date"], "2026-08-10")

        updated = self.client.put(f"/api/receipts/{receipt_id}",
                                  json={"name": "Rent", "amount": "200", "date": "2026-08-11"})
        self.assertEqual(updated.get_json()["receipt"]["amount"], 200.0)

        self.assertEqual(self.client.delete(f"/api/receipts/{receipt_id}").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/receipts/{receipt_id}").status_code, 404)

    def test_date_range_filter(self):
        self.add(date="2026-07-15", amount="10")
        self.add(date="2026-08-15", amount="20")
        board = self.client.get("/api/dashboard?start=2026-08-01&end=2026-08-31").get_json()
        self.assertEqual(len(board["receipts"]), 1)
        self.assertEqual(board["summary"]["total"], 20.0)
        self.assertEqual(board["summary"]["previous_total"], 10.0)

    def test_areas_group_by_name(self):
        self.add(name="Fresh Produce", amount="100", date="2026-08-01")
        self.add(name="fresh  produce", amount="50", date="2026-08-02")
        summary = self.client.get(
            "/api/dashboard?start=2026-08-01&end=2026-08-31").get_json()["summary"]
        self.assertEqual(len(summary["areas"]), 1)
        self.assertEqual(summary["areas"][0]["total"], 150.0)
        self.assertEqual(summary["areas"][0]["count"], 2)

    def test_name_suggestions_group_without_a_bare_column(self):
        """GROUP BY group_key with a bare `name` is legal in SQLite, illegal here."""
        self.add(name="Alpha", date="2026-08-01")
        self.add(name="Beta", date="2026-08-02")
        self.add(name="Beta", date="2026-08-03")
        names = self.client.get(
            "/api/dashboard?start=2026-08-01&end=2026-08-31").get_json()["suggestions"]
        self.assertEqual(names[0], "Beta")   # most used first
        self.assertIn("Alpha", names)

    def test_bulk_insert_and_bounds(self):
        from sskreceipts.sampledata import seed
        with self.app.app_context():
            count = seed(months=3)
            self.assertGreater(count, 0)
        bounds = self.client.get("/api/dashboard").get_json()["bounds"]
        self.assertIsNotNone(bounds["earliest"])
        self.assertLessEqual(bounds["earliest"], bounds["latest"])

    def test_csv_export(self):
        self.add(name="Produce", amount="100.50", date="2026-08-10")
        body = self.client.get(
            "/api/export.csv?start=2026-08-01&end=2026-08-31").get_data(as_text=True)
        self.assertIn("Produce,100.50", body)
        self.assertIn("Total,,100.50", body)

    def test_validation_still_rejects_bad_input(self):
        response = self.client.post("/api/receipts",
                                    json={"name": "X", "amount": "-1", "date": "2026-08-10"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["field"], "amount")

    def test_empty_range(self):
        summary = self.client.get(
            "/api/dashboard?start=2026-08-01&end=2026-08-31").get_json()["summary"]
        self.assertEqual(summary["total"], 0)
        self.assertIsNone(summary["top_area"])

    def test_index_renders(self):
        self.assertEqual(self.client.get("/").status_code, 200)


if __name__ == "__main__":
    unittest.main()
