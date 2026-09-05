"""The metric catalogue and the week arithmetic every chart is built on.

A metric is defined once here and everything else - the entry form, the chart
grid, the KPI tiles, the delta colouring - reads it from this list. Adding a
metric to the catalogue is the whole change needed to start tracking it.

``direction`` is the piece that stops a dashboard lying: for AHT a *fall* is an
improvement, so the sign of a week-on-week change tells you nothing on its own.
Every delta in the UI is coloured by ``direction``, never by sign.
"""

from __future__ import annotations

import datetime as dt

METRICS = [
    {
        "key": "qa",
        "label": "QA Score",
        "unit": "%",
        "direction": "up",
        "target": 90.0,
        "min": 0.0,
        "max": 100.0,
        "decimals": 1,
        "description": "Quality audit score across sampled calls.",
    },
    {
        "key": "csat",
        "label": "CSAT",
        "unit": "%",
        "direction": "up",
        "target": 85.0,
        "min": 0.0,
        "max": 100.0,
        "decimals": 1,
        "description": "Share of post-call surveys rated satisfied.",
    },
    {
        "key": "aht",
        "label": "AHT",
        "unit": "min",
        "direction": "down",
        "target": 6.5,
        "min": 0.0,
        "max": 120.0,
        "decimals": 2,
        "description": "Average handle time. Lower is better.",
    },
    {
        "key": "attendance",
        "label": "Attendance",
        "unit": "%",
        "direction": "up",
        "target": 97.0,
        "min": 0.0,
        "max": 100.0,
        "decimals": 1,
        "description": "Scheduled hours actually worked.",
    },
    {
        "key": "conversion",
        "label": "Sales Conversion",
        "unit": "%",
        "direction": "up",
        "target": 12.0,
        "min": 0.0,
        "max": 100.0,
        "decimals": 1,
        "description": "Calls that closed a sale.",
    },
]

METRICS_BY_KEY = {m["key"]: m for m in METRICS}
METRIC_KEYS = tuple(m["key"] for m in METRICS)

# The coaching-log category list. Free-text would fragment the data within a
# month; a fixed list keeps "why was this person coached" answerable.
CATEGORIES = [
    "Quality / QA",
    "Customer Experience",
    "Productivity / AHT",
    "Attendance & Punctuality",
    "Sales / Conversion",
    "Behaviour & Conduct",
    "Recognition",
    "Other",
]

STATUSES = ["open", "in_progress", "closed"]


def is_metric(key: str) -> bool:
    return key in METRICS_BY_KEY


def week_start(day: dt.date) -> dt.date:
    """The Monday of ``day``'s ISO week - the bucket every metric lands in."""
    return day - dt.timedelta(days=day.weekday())


def week_start_str(value: str) -> str:
    """Normalise any ISO date to its week's Monday, as ``YYYY-MM-DD``."""
    return week_start(dt.date.fromisoformat(value)).isoformat()


def week_label(iso_monday: str) -> str:
    """``2026-08-31`` -> ``W36 · Aug 31`` - the x-axis tick."""
    day = dt.date.fromisoformat(iso_monday)
    # %-d is glibc-only; building the day number by hand keeps this portable.
    return f"W{day.isocalendar().week:02d} · {day.strftime('%b')} {day.day}"


def week_tick(iso_monday: str) -> str:
    """The short axis form - ``Aug 31``. The week number lives in the tooltip."""
    day = dt.date.fromisoformat(iso_monday)
    return f"{day.strftime('%b')} {day.day}"


def recent_weeks(count: int, today: dt.date | None = None) -> list[str]:
    """The last ``count`` week-start dates, oldest first, ending this week."""
    end = week_start(today or dt.date.today())
    return [(end - dt.timedelta(weeks=i)).isoformat() for i in range(count - 1, -1, -1)]


def improved(metric_key: str, delta: float) -> bool | None:
    """Did a change of ``delta`` move this metric the right way?

    ``None`` for no movement, so the UI can render a flat delta as neutral
    rather than picking an arbitrary colour for zero.
    """
    if delta == 0:
        return None
    wants_up = METRICS_BY_KEY[metric_key]["direction"] == "up"
    return delta > 0 if wants_up else delta < 0


def catalogue() -> list[dict]:
    """The catalogue as the front end consumes it."""
    return [dict(m) for m in METRICS]
