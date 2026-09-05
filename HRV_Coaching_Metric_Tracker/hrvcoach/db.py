"""Every query the app runs.

The SQL lives here; :mod:`hrvcoach.storage` decides which engine runs it
(SQLite locally, Postgres when ``DATABASE_URL`` is set). Queries are written in
SQLite's ``?`` placeholder style and translated for Postgres, so there is one
copy of every statement.

Scoping note: functions that read coaching logs or metrics take an explicit
``employee_uid`` filter rather than trusting the caller to filter afterwards.
An employee seeing a colleague's coaching log is the one bug this app must not
have, so the restriction is in the WHERE clause, not in a template.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

import click
from flask import Flask, current_app, g

from . import metrics as metric_catalogue
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
            if current_app.config.get("SEED_DEMO"):
                from . import sampledata

                sampledata.seed_if_empty(db)
        g.db = db
    return g.db


def close_db(_exc: BaseException | None = None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = get_db()
    db.executescript(storage.schema_for(db.dialect))


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def _rows(cursor) -> list[dict]:
    return [dict(row) for row in cursor.fetchall()]


def _one(cursor) -> dict | None:
    row = cursor.fetchone()
    return dict(row) if row else None


def _new_id(db: Database, cursor) -> int:
    """The id of the row just inserted, both dialects.

    Postgres returns it from RETURNING; SQLite exposes it on the cursor.
    """
    if db.dialect == "postgres":
        return int(cursor.fetchone()["id"])
    return int(cursor.lastrowid)


# --- users -----------------------------------------------------------------

USER_COLUMNS = "id, employee_id, full_name, role, team, active, created_at"


def user_by_employee_id(employee_id: str) -> dict | None:
    """Case-insensitive, because nobody types EMP-004 the same way twice."""
    db = get_db()
    return _one(
        db.execute(
            f"SELECT {USER_COLUMNS}, password_hash FROM users "
            "WHERE LOWER(employee_id) = LOWER(?)",
            (employee_id,),
        )
    )


def user_by_id(uid: int) -> dict | None:
    db = get_db()
    return _one(db.execute(f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", (uid,)))


def list_users(*, role: str | None = None, include_inactive: bool = True) -> list[dict]:
    db = get_db()
    clauses, params = [], []
    if role:
        clauses.append("role = ?")
        params.append(role)
    if not include_inactive:
        clauses.append("active = 1")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return _rows(
        db.execute(f"SELECT {USER_COLUMNS} FROM users {where} ORDER BY full_name", params)
    )


def create_user(
    *, employee_id: str, full_name: str, role: str, team: str, password_hash: str
) -> int:
    db = get_db()
    returning = " RETURNING id" if db.dialect == "postgres" else ""
    cursor = db.execute(
        "INSERT INTO users (employee_id, full_name, role, team, password_hash, active, created_at) "
        f"VALUES (?, ?, ?, ?, ?, 1, ?){returning}",
        (employee_id, full_name, role, team, password_hash, now()),
    )
    uid = _new_id(db, cursor)
    db.commit()
    return uid


def update_user(uid: int, fields: dict[str, Any]) -> bool:
    if not fields:
        return False
    db = get_db()
    assignments = ", ".join(f"{name} = ?" for name in fields)
    cursor = db.execute(
        f"UPDATE users SET {assignments} WHERE id = ?", (*fields.values(), uid)
    )
    db.commit()
    return cursor.rowcount > 0


def count_users() -> int:
    row = _one(get_db().execute("SELECT COUNT(*) AS n FROM users"))
    return int(row["n"]) if row else 0


def count_active_admins(*, excluding: int | None = None) -> int:
    """Used to refuse the change that would lock everyone out of the admin side."""
    db = get_db()
    clause = " AND id <> ?" if excluding is not None else ""
    params = (excluding,) if excluding is not None else ()
    row = _one(
        db.execute(
            f"SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1{clause}",
            params,
        )
    )
    return int(row["n"]) if row else 0


# --- coaching logs ---------------------------------------------------------

LOG_COLUMNS = """
    l.id, l.employee_uid, l.coach_uid, l.session_date, l.week_start, l.category,
    l.metric_key, l.opportunity, l.root_cause, l.action_plan, l.support,
    l.follow_up_date, l.status, l.acknowledged_at, l.created_at, l.updated_at,
    e.full_name AS employee_name, e.employee_id AS employee_code, e.team AS employee_team,
    c.full_name AS coach_name
"""

_LOG_JOINS = """
    FROM coaching_logs l
    JOIN users e ON e.id = l.employee_uid
    LEFT JOIN users c ON c.id = l.coach_uid
"""


def list_logs(
    *,
    employee_uid: int | None = None,
    status: str | None = None,
    metric_key: str | None = None,
    search: str | None = None,
    limit: int = 200,
) -> list[dict]:
    db = get_db()
    clauses, params = [], []
    if employee_uid is not None:
        clauses.append("l.employee_uid = ?")
        params.append(employee_uid)
    if status:
        clauses.append("l.status = ?")
        params.append(status)
    if metric_key:
        clauses.append("l.metric_key = ?")
        params.append(metric_key)
    if search:
        needle = f"%{search.lower()}%"
        clauses.append(
            "(LOWER(l.opportunity) LIKE ? OR LOWER(l.action_plan) LIKE ? "
            "OR LOWER(l.root_cause) LIKE ? OR LOWER(e.full_name) LIKE ? "
            "OR LOWER(e.employee_id) LIKE ?)"
        )
        params.extend([needle] * 5)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    logs = _rows(
        db.execute(
            f"SELECT {LOG_COLUMNS} {_LOG_JOINS} {where} "
            "ORDER BY l.session_date DESC, l.id DESC LIMIT ?",
            (*params, limit),
        )
    )
    attach_recordings(logs)
    return logs


def get_log(log_id: int, *, employee_uid: int | None = None) -> dict | None:
    db = get_db()
    clause = " AND l.employee_uid = ?" if employee_uid is not None else ""
    params: tuple = (log_id, employee_uid) if employee_uid is not None else (log_id,)
    log = _one(db.execute(f"SELECT {LOG_COLUMNS} {_LOG_JOINS} WHERE l.id = ?{clause}", params))
    if log:
        attach_recordings([log])
    return log


def create_log(fields: dict[str, Any]) -> int:
    db = get_db()
    stamp = now()
    columns = (
        "employee_uid", "coach_uid", "session_date", "week_start", "category",
        "metric_key", "opportunity", "root_cause", "action_plan", "support",
        "follow_up_date", "status",
    )
    values = [fields[name] for name in columns]
    returning = " RETURNING id" if db.dialect == "postgres" else ""
    cursor = db.execute(
        f"INSERT INTO coaching_logs ({', '.join(columns)}, acknowledged_at, created_at, updated_at) "
        f"VALUES ({', '.join('?' * len(columns))}, '', ?, ?){returning}",
        (*values, stamp, stamp),
    )
    log_id = _new_id(db, cursor)
    db.commit()
    return log_id


def update_log(log_id: int, fields: dict[str, Any]) -> bool:
    if not fields:
        return False
    db = get_db()
    payload = {**fields, "updated_at": now()}
    assignments = ", ".join(f"{name} = ?" for name in payload)
    cursor = db.execute(
        f"UPDATE coaching_logs SET {assignments} WHERE id = ?", (*payload.values(), log_id)
    )
    db.commit()
    return cursor.rowcount > 0


def delete_log(log_id: int) -> bool:
    db = get_db()
    # SQLite enforces ON DELETE CASCADE only with the pragma set (it is, in
    # storage.connect); the explicit child delete keeps this correct either way.
    db.execute("DELETE FROM recordings WHERE log_id = ?", (log_id,))
    cursor = db.execute("DELETE FROM coaching_logs WHERE id = ?", (log_id,))
    db.commit()
    return cursor.rowcount > 0


def log_owner(log_id: int) -> int | None:
    row = _one(get_db().execute("SELECT employee_uid FROM coaching_logs WHERE id = ?", (log_id,)))
    return int(row["employee_uid"]) if row else None


# --- recordings ------------------------------------------------------------

def attach_recordings(logs: list[dict]) -> None:
    """Fill each log's ``recordings`` list - metadata only, never the blob."""
    for log in logs:
        log["recordings"] = []
    if not logs:
        return
    by_id = {log["id"]: log for log in logs}
    placeholders = ", ".join("?" * len(by_id))
    rows = _rows(
        get_db().execute(
            "SELECT id, log_id, filename, content_type, size_bytes, call_ref, uploaded_at "
            f"FROM recordings WHERE log_id IN ({placeholders}) ORDER BY id",
            tuple(by_id),
        )
    )
    for row in rows:
        by_id[row["log_id"]]["recordings"].append(row)


def add_recording(
    *, log_id: int, filename: str, content_type: str, data: bytes, call_ref: str
) -> int:
    db = get_db()
    returning = " RETURNING id" if db.dialect == "postgres" else ""
    cursor = db.execute(
        "INSERT INTO recordings (log_id, filename, content_type, size_bytes, call_ref, data, uploaded_at) "
        f"VALUES (?, ?, ?, ?, ?, ?, ?){returning}",
        (log_id, filename, content_type, len(data), call_ref, storage.blob(data, db.dialect), now()),
    )
    recording_id = _new_id(db, cursor)
    db.commit()
    return recording_id


def get_recording(recording_id: int) -> dict | None:
    """The full row including bytes - only the streaming view calls this."""
    row = _one(
        get_db().execute(
            "SELECT r.id, r.log_id, r.filename, r.content_type, r.size_bytes, r.data, "
            "l.employee_uid FROM recordings r JOIN coaching_logs l ON l.id = r.log_id "
            "WHERE r.id = ?",
            (recording_id,),
        )
    )
    if row is not None:
        row["data"] = bytes(row["data"])
    return row


def delete_recording(recording_id: int) -> bool:
    db = get_db()
    cursor = db.execute("DELETE FROM recordings WHERE id = ?", (recording_id,))
    db.commit()
    return cursor.rowcount > 0


# --- metrics ---------------------------------------------------------------

def list_metrics(*, employee_uid: int | None = None, since: str | None = None) -> list[dict]:
    db = get_db()
    clauses, params = [], []
    if employee_uid is not None:
        clauses.append("employee_uid = ?")
        params.append(employee_uid)
    if since:
        clauses.append("week_start >= ?")
        params.append(since)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return _rows(
        db.execute(
            "SELECT id, employee_uid, week_start, metric_key, value, note, updated_at "
            f"FROM metrics {where} ORDER BY week_start, metric_key",
            params,
        )
    )


def team_averages(*, since: str, exclude_uid: int | None = None) -> list[dict]:
    """Mean value per metric per week across every active employee.

    The comparison series on each chart. Admins are excluded - a team leader's
    own row would otherwise drag the line the team is measured against.
    """
    db = get_db()
    clause = " AND m.employee_uid <> ?" if exclude_uid is not None else ""
    params: tuple = (since, exclude_uid) if exclude_uid is not None else (since,)
    return _rows(
        db.execute(
            "SELECT m.week_start, m.metric_key, AVG(m.value) AS value, COUNT(*) AS n "
            "FROM metrics m JOIN users u ON u.id = m.employee_uid "
            f"WHERE m.week_start >= ? AND u.role = 'employee' AND u.active = 1{clause} "
            "GROUP BY m.week_start, m.metric_key ORDER BY m.week_start",
            params,
        )
    )


def upsert_metric(
    *, employee_uid: int, week_start: str, metric_key: str, value: float, note: str
) -> None:
    """One value per employee per metric per week - re-entering it corrects it."""
    db = get_db()
    stamp = now()
    db.execute(
        "INSERT INTO metrics (employee_uid, week_start, metric_key, value, note, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT (employee_uid, week_start, metric_key) DO UPDATE SET "
        "value = EXCLUDED.value, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at",
        (employee_uid, week_start, metric_key, value, note, stamp, stamp),
    )
    db.commit()


def delete_metric(*, employee_uid: int, week_start: str, metric_key: str) -> bool:
    db = get_db()
    cursor = db.execute(
        "DELETE FROM metrics WHERE employee_uid = ? AND week_start = ? AND metric_key = ?",
        (employee_uid, week_start, metric_key),
    )
    db.commit()
    return cursor.rowcount > 0


def log_counts_by_status(*, employee_uid: int | None = None) -> dict[str, int]:
    db = get_db()
    clause = "WHERE employee_uid = ?" if employee_uid is not None else ""
    params: tuple = (employee_uid,) if employee_uid is not None else ()
    rows = _rows(
        db.execute(f"SELECT status, COUNT(*) AS n FROM coaching_logs {clause} GROUP BY status", params)
    )
    counts = {status: 0 for status in metric_catalogue.STATUSES}
    for row in rows:
        counts[row["status"]] = int(row["n"])
    return counts


# --- CLI -------------------------------------------------------------------

@click.command("init-db")
def init_db_command() -> None:
    """Create the tables (safe to re-run)."""
    init_db()
    click.echo("Tables ready.")


def register(app: Flask) -> None:
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
