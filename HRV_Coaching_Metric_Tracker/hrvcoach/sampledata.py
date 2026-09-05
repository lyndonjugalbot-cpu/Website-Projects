"""A demo roster so a fresh install opens onto a working dashboard.

Seeded only when the database is empty and ``HRV_SEED_DEMO`` is on, so it can
never overwrite real data. The numbers are generated from a fixed seed - the
same charts appear on every machine, which makes "does the trend line look
right?" a question two people can answer together.

Set ``HRV_SEED_DEMO=0`` before the first run to start empty; you will then need
``flask --app run create-admin`` to make the first account.
"""

from __future__ import annotations

import datetime as dt
import random

from werkzeug.security import generate_password_hash

from . import metrics
from .storage import Database

DEMO_PASSWORD = "coach1234"

# (employee_id, name, role, team, per-metric starting point and weekly drift)
PEOPLE = [
    ("TL-001", "Marites Bautista", "admin", "Voice - Team Alpha", None),
    ("EMP-101", "Aaron Villanueva", "employee", "Voice - Team Alpha",
     {"qa": (86, 0.55), "csat": (81, 0.5), "aht": (7.6, -0.09), "attendance": (96, 0.15), "conversion": (9.5, 0.3)}),
    ("EMP-102", "Bea Salcedo", "employee", "Voice - Team Alpha",
     {"qa": (93, 0.08), "csat": (89, 0.12), "aht": (6.1, -0.01), "attendance": (99, 0.02), "conversion": (14.0, 0.1)}),
    ("EMP-103", "Carlo Mendoza", "employee", "Voice - Team Alpha",
     {"qa": (90, -0.62), "csat": (87, -0.55), "aht": (6.4, 0.12), "attendance": (97, -0.35), "conversion": (12.5, -0.28)}),
    ("EMP-104", "Divina Reyes", "employee", "Voice - Team Bravo",
     {"qa": (88, 0.2), "csat": (84, 0.25), "aht": (7.0, -0.04), "attendance": (95, 0.3), "conversion": (10.8, 0.18)}),
]

LOGS = [
    {
        "employee_id": "EMP-101",
        "weeks_ago": 5,
        "category": "Quality / QA",
        "metric_key": "qa",
        "opportunity": "Missed the mandatory verification script on 3 of 5 audited calls, and closed two of them without recapping the resolution.",
        "root_cause": "Working from the old cheat sheet - had not seen the July script update.",
        "action_plan": "Aaron re-reads the July call flow before shift for the next two weeks and self-audits one call daily against the QA form. TL re-audits 5 calls at the end of week 2.",
        "support": "Sent the updated flow and the QA rubric; booked a 15-minute walkthrough on Wednesday.",
        "status": "closed",
        "acknowledged": True,
    },
    {
        "employee_id": "EMP-101",
        "weeks_ago": 2,
        "category": "Sales / Conversion",
        "metric_key": "conversion",
        "opportunity": "Conversion is climbing but the offer is still made late - usually after the customer has already asked to end the call.",
        "root_cause": "Waits for a 'perfect moment' rather than bridging from the resolution.",
        "action_plan": "Use the resolve-then-bridge line within 30 seconds of confirming the fix. Aaron logs the bridge attempt on every call for one week.",
        "support": "Two recorded examples from Bea shared; role-play booked Friday.",
        "status": "in_progress",
        "acknowledged": True,
    },
    {
        "employee_id": "EMP-103",
        "weeks_ago": 1,
        "category": "Customer Experience",
        "metric_key": "csat",
        "opportunity": "CSAT has fallen four weeks running. Survey verbatims mention being talked over and a rushed close.",
        "root_cause": "Handling back-to-back escalations without a reset; frustration is carrying into the next call.",
        "action_plan": "Take the 2-minute after-escalation reset before going available. Use the acknowledge-empathise-act opener on every escalated call. Review together next Monday.",
        "support": "Escalation queue reduced to 4 a day for two weeks; buddy shift with Bea on Thursday.",
        "status": "open",
        "acknowledged": False,
    },
    {
        "employee_id": "EMP-102",
        "weeks_ago": 3,
        "category": "Recognition",
        "metric_key": "qa",
        "opportunity": "Four consecutive weeks above 92% QA with the shortest AHT on the team - worth naming and worth copying.",
        "root_cause": "",
        "action_plan": "Bea records a 5-minute walkthrough of her call opening for the team huddle, and buddies with Carlo on Thursday.",
        "support": "Nominated for the monthly quality award.",
        "status": "closed",
        "acknowledged": True,
    },
    {
        "employee_id": "EMP-104",
        "weeks_ago": 4,
        "category": "Attendance & Punctuality",
        "metric_key": "attendance",
        "opportunity": "Three late logins in one week, each 10-20 minutes, all on early shifts.",
        "root_cause": "Commute from the new address does not fit the 6am start.",
        "action_plan": "Move to the 8am start from next schedule cycle. Divina confirms the shift-swap request by Friday.",
        "support": "WFM notified; swap pre-approved.",
        "status": "closed",
        "acknowledged": True,
    },
]


def _generate_metrics(spec: dict, weeks: list[str], rng: random.Random) -> list[tuple]:
    """A believable series: a trend plus week-to-week noise, clamped to range."""
    rows = []
    for key, (start, drift) in spec.items():
        limits = metrics.METRICS_BY_KEY[key]
        for index, week in enumerate(weeks):
            noise = rng.uniform(-1, 1) * (0.9 if limits["unit"] == "%" else 0.25)
            value = start + drift * index + noise
            value = max(limits["min"], min(limits["max"], value))
            rows.append((week, key, round(value, 2)))
    return rows


def seed_if_empty(db: Database) -> bool:
    """Populate a brand-new database. Returns True if anything was written."""
    existing = db.execute("SELECT COUNT(*) AS n FROM users").fetchone()
    count = existing["n"] if not isinstance(existing, tuple) else existing[0]
    if int(count) > 0:
        return False

    rng = random.Random(20260905)
    stamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    weeks = metrics.recent_weeks(14)
    returning = " RETURNING id" if db.dialect == "postgres" else ""
    uids: dict[str, int] = {}

    for employee_id, name, role, team, _ in PEOPLE:
        cursor = db.execute(
            "INSERT INTO users (employee_id, full_name, role, team, password_hash, active, created_at) "
            f"VALUES (?, ?, ?, ?, ?, 1, ?){returning}",
            (employee_id, name, role, team, generate_password_hash(DEMO_PASSWORD), stamp),
        )
        uids[employee_id] = (
            int(cursor.fetchone()["id"]) if db.dialect == "postgres" else int(cursor.lastrowid)
        )

    for employee_id, _, _, _, spec in PEOPLE:
        if not spec:
            continue
        db.executemany(
            "INSERT INTO metrics (employee_uid, week_start, metric_key, value, note, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, '', ?, ?)",
            [
                (uids[employee_id], week, key, value, stamp, stamp)
                for week, key, value in _generate_metrics(spec, weeks, rng)
            ],
        )

    coach_uid = uids["TL-001"]
    today = dt.date.today()
    for entry in LOGS:
        session_date = today - dt.timedelta(weeks=entry["weeks_ago"])
        follow_up = (session_date + dt.timedelta(days=7)).isoformat()
        db.execute(
            "INSERT INTO coaching_logs (employee_uid, coach_uid, session_date, week_start, category, "
            "metric_key, opportunity, root_cause, action_plan, support, follow_up_date, status, "
            "acknowledged_at, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                uids[entry["employee_id"]],
                coach_uid,
                session_date.isoformat(),
                metrics.week_start(session_date).isoformat(),
                entry["category"],
                entry["metric_key"],
                entry["opportunity"],
                entry["root_cause"],
                entry["action_plan"],
                entry["support"],
                follow_up,
                entry["status"],
                stamp if entry["acknowledged"] else "",
                stamp,
                stamp,
            ),
        )

    db.commit()
    return True
