"""Receipt queries.

The SQL lives here; :mod:`sskreceipts.storage` decides which engine runs it
(SQLite locally, Postgres when ``DATABASE_URL`` is set). Queries are written in
SQLite's ``?`` placeholder style and translated for Postgres, so there is one
copy of every statement.
"""

from __future__ import annotations

import datetime as dt
from typing import Any, Iterable

import click
from flask import Flask, current_app, g

from . import storage
from .storage import Database

# The schema is created on first use, once per process. On a serverless host
# that means one CREATE TABLE IF NOT EXISTS per cold start rather than one per
# request, and a database that is unreachable fails a request instead of the
# whole app import.
_initialised: set[str] = set()


def get_db() -> Database:
    """The request-scoped connection, opened lazily."""
    if "db" not in g:
        db = storage.connect(current_app.config)
        key = current_app.config.get("DATABASE_URL") or current_app.config["DATABASE"]
        if key not in _initialised:
            db.executescript(storage.schema_for(db.dialect))
            _initialised.add(key)
        g.db = db
    return g.db


def close_db(_exc: BaseException | None = None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = get_db()
    db.executescript(storage.schema_for(db.dialect))


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


# --- queries ---------------------------------------------------------------

def _range_clause(start: dt.date | None, end: dt.date | None) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if start is not None:
        clauses.append("date >= ?")
        params.append(start.isoformat())
    if end is not None:
        clauses.append("date <= ?")
        params.append(end.isoformat())
    return (" WHERE " + " AND ".join(clauses)) if clauses else "", params


def list_receipts(start: dt.date | None = None, end: dt.date | None = None) -> list[Any]:
    where, params = _range_clause(start, end)
    return get_db().execute(
        f"SELECT * FROM receipts{where} ORDER BY date DESC, id DESC", params
    ).fetchall()


def get_receipt(receipt_id: int) -> Any | None:
    return get_db().execute("SELECT * FROM receipts WHERE id = ?", (receipt_id,)).fetchone()


def insert_receipt(name: str, key: str, amount_minor: int, date: dt.date) -> int:
    now = _now()
    # RETURNING works on both engines (SQLite >= 3.35), so there is no need for
    # a lastrowid special case.
    row = get_db().execute(
        "INSERT INTO receipts (name, group_key, amount_minor, date, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        (name, key, amount_minor, date.isoformat(), now, now),
    ).fetchone()
    get_db().commit()
    return int(row["id"])


def update_receipt(receipt_id: int, name: str, key: str, amount_minor: int, date: dt.date) -> bool:
    cur = get_db().execute(
        "UPDATE receipts SET name = ?, group_key = ?, amount_minor = ?, date = ?, updated_at = ?"
        " WHERE id = ?",
        (name, key, amount_minor, date.isoformat(), _now(), receipt_id),
    )
    get_db().commit()
    return cur.rowcount > 0


def delete_receipt(receipt_id: int) -> bool:
    cur = get_db().execute("DELETE FROM receipts WHERE id = ?", (receipt_id,))
    get_db().commit()
    return cur.rowcount > 0


def date_bounds() -> tuple[str | None, str | None]:
    """Earliest and latest receipt date on record - drives the "All time" preset."""
    row = get_db().execute("SELECT MIN(date) AS lo, MAX(date) AS hi FROM receipts").fetchone()
    return (row["lo"], row["hi"]) if row else (None, None)


def name_suggestions(limit: int = 200) -> list[str]:
    """Distinct receipt names, most-used first, for the form's autocomplete."""
    rows = get_db().execute(
        "SELECT MAX(name) AS name, COUNT(*) AS n, MAX(date) AS last_date FROM receipts"
        " GROUP BY group_key ORDER BY n DESC, last_date DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [r["name"] for r in rows]


def bulk_insert(rows: Iterable[tuple[str, str, int, dt.date]]) -> int:
    now = _now()
    payload = [(n, k, a, d.isoformat(), now, now) for n, k, a, d in rows]
    db = get_db()
    db.executemany(
        "INSERT INTO receipts (name, group_key, amount_minor, date, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        payload,
    )
    db.commit()
    return len(payload)


# --- CLI -------------------------------------------------------------------

@click.command("init-db")
def init_db_command() -> None:
    """Create the database tables."""
    init_db()
    click.echo(f"Initialised {current_app.config.get('DATABASE_URL') or current_app.config['DATABASE']}")


@click.command("seed-db")
@click.option("--months", default=6, show_default=True, help="How many months of sample data.")
def seed_db_command(months: int) -> None:
    """Fill the database with realistic sample receipts (for a demo/test drive)."""
    from .sampledata import seed

    init_db()
    count = seed(months=months)
    click.echo(f"Seeded {count} sample receipts.")


def register(app: Flask) -> None:
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    app.cli.add_command(seed_db_command)
