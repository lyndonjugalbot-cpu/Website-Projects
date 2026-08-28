"""SQLite persistence.

One table, one index. SQLite is the right store here: a single store's receipts
are thousands of rows a year, the file is trivially backed up, and there is no
server to run alongside Flask.
"""

from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any, Iterable

import click
from flask import Flask, current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS receipts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    group_key    TEXT    NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    date         TEXT    NOT NULL,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts (date);
CREATE INDEX IF NOT EXISTS idx_receipts_group ON receipts (group_key);
"""


def get_db() -> sqlite3.Connection:
    """The request-scoped connection, opened lazily."""
    if "db" not in g:
        conn = sqlite3.connect(
            current_app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        # WAL keeps a long-running read (a chart query) from blocking a write.
        conn.execute("PRAGMA journal_mode = WAL")
        g.db = conn
    return g.db


def close_db(_exc: BaseException | None = None) -> None:
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db() -> None:
    get_db().executescript(SCHEMA)


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


def list_receipts(start: dt.date | None = None, end: dt.date | None = None) -> list[sqlite3.Row]:
    where, params = _range_clause(start, end)
    return get_db().execute(
        f"SELECT * FROM receipts{where} ORDER BY date DESC, id DESC", params
    ).fetchall()


def get_receipt(receipt_id: int) -> sqlite3.Row | None:
    return get_db().execute("SELECT * FROM receipts WHERE id = ?", (receipt_id,)).fetchone()


def insert_receipt(name: str, key: str, amount_minor: int, date: dt.date) -> int:
    now = _now()
    cur = get_db().execute(
        "INSERT INTO receipts (name, group_key, amount_minor, date, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (name, key, amount_minor, date.isoformat(), now, now),
    )
    get_db().commit()
    return int(cur.lastrowid)


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
        "SELECT name, COUNT(*) AS n FROM receipts"
        " GROUP BY group_key ORDER BY n DESC, MAX(date) DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [r["name"] for r in rows]


def bulk_insert(rows: Iterable[tuple[str, str, int, dt.date]]) -> int:
    now = _now()
    payload = [(n, k, a, d.isoformat(), now, now) for n, k, a, d in rows]
    get_db().executemany(
        "INSERT INTO receipts (name, group_key, amount_minor, date, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        payload,
    )
    get_db().commit()
    return len(payload)


# --- CLI -------------------------------------------------------------------

@click.command("init-db")
def init_db_command() -> None:
    """Create the database file and tables."""
    init_db()
    click.echo(f"Initialised {current_app.config['DATABASE']}")


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
