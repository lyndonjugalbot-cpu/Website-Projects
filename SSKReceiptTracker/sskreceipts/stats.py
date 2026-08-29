"""Aggregations behind the KPI tiles and the two charts.

All arithmetic stays in integer minor units; conversion to float happens once,
at the JSON boundary. Every function takes plain row mappings so the module is
testable without a database or an app context.
"""

from __future__ import annotations

import datetime as dt
from typing import Any, Iterable, Mapping, Sequence

from .money import to_major

# How many spending areas get their own bar before the tail folds into "Other".
# The dataviz rule: never invent more colour classes - fold the tail.
TOP_AREAS = 8

_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


# --- time bucketing --------------------------------------------------------

def choose_granularity(start: dt.date, end: dt.date) -> str:
    """Pick a bucket size that yields a readable number of points."""
    span = (end - start).days + 1
    if span <= 31:
        return "day"
    if span <= 122:
        return "week"
    return "month"


def bucket_start(date: dt.date, granularity: str) -> dt.date:
    if granularity == "day":
        return date
    if granularity == "week":
        return date - dt.timedelta(days=date.weekday())  # Monday
    return date.replace(day=1)


def next_bucket(date: dt.date, granularity: str) -> dt.date:
    if granularity == "day":
        return date + dt.timedelta(days=1)
    if granularity == "week":
        return date + dt.timedelta(days=7)
    return (date.replace(day=28) + dt.timedelta(days=4)).replace(day=1)


def bucket_label(date: dt.date, granularity: str) -> str:
    if granularity == "month":
        return f"{_MONTHS[date.month - 1]} {date.year}"
    return f"{_MONTHS[date.month - 1]} {date.day}"


def _series(rows: Sequence[Mapping[str, Any]], start: dt.date, end: dt.date) -> dict[str, Any]:
    """Zero-filled spend-over-time series.

    Empty buckets are emitted explicitly: a gap in the data is information, and
    skipping it would draw a line straight over a week with no spending.
    """
    granularity = choose_granularity(start, end)

    totals: dict[dt.date, int] = {}
    counts: dict[dt.date, int] = {}
    for row in rows:
        key = bucket_start(dt.date.fromisoformat(row["date"]), granularity)
        totals[key] = totals.get(key, 0) + row["amount_minor"]
        counts[key] = counts.get(key, 0) + 1

    points: list[dict[str, Any]] = []
    cursor = bucket_start(start, granularity)
    last = bucket_start(end, granularity)
    while cursor <= last:
        points.append({
            "date": cursor.isoformat(),
            "label": bucket_label(cursor, granularity),
            "total": to_major(totals.get(cursor, 0)),
            "count": counts.get(cursor, 0),
        })
        cursor = next_bucket(cursor, granularity)

    return {"granularity": granularity, "points": points}


# --- area rollup -----------------------------------------------------------

def _areas(rows: Sequence[Mapping[str, Any]], total_minor: int) -> list[dict[str, Any]]:
    """Spend per area (receipts sharing a name), largest first."""
    acc: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = row["group_key"]
        entry = acc.get(key)
        if entry is None:
            entry = acc[key] = {
                "key": key, "name": row["name"], "total_minor": 0,
                "count": 0, "last_date": row["date"],
            }
        entry["total_minor"] += row["amount_minor"]
        entry["count"] += 1
        if row["date"] >= entry["last_date"]:
            # Display the spelling used on the most recent receipt.
            entry["last_date"] = row["date"]
            entry["name"] = row["name"]

    areas = sorted(acc.values(), key=lambda a: (-a["total_minor"], a["name"].casefold()))
    return [{
        "key": a["key"],
        "name": a["name"],
        "total": to_major(a["total_minor"]),
        "count": a["count"],
        "share": round(a["total_minor"] / total_minor * 100, 1) if total_minor else 0.0,
        "last_date": a["last_date"],
    } for a in areas]


def fold_tail(areas: Sequence[Mapping[str, Any]], limit: int = TOP_AREAS) -> list[dict[str, Any]]:
    """Keep the top ``limit`` areas; collapse everything below into "Other"."""
    if len(areas) <= limit:
        return [dict(a) for a in areas]

    head = [dict(a) for a in areas[:limit]]
    tail = areas[limit:]
    head.append({
        "key": "__other__",
        "name": f"Other ({len(tail)} areas)",
        "total": round(sum(a["total"] for a in tail), 2),
        "count": sum(a["count"] for a in tail),
        "share": round(sum(a["share"] for a in tail), 1),
        "last_date": max(a["last_date"] for a in tail),
        "is_other": True,
    })
    return head


# --- top level -------------------------------------------------------------

def summarise(
    rows: Sequence[Mapping[str, Any]],
    start: dt.date,
    end: dt.date,
    previous_total_minor: int | None = None,
) -> dict[str, Any]:
    """Everything the dashboard needs for one date range."""
    total_minor = sum(r["amount_minor"] for r in rows)
    count = len(rows)
    days = (end - start).days + 1
    areas = _areas(rows, total_minor)

    # With no previous period, or a previous period of zero, there is no honest
    # percentage to show - leave it null rather than inventing "+infinity%".
    change_pct: float | None = None
    if previous_total_minor:
        change_pct = round((total_minor - previous_total_minor) / previous_total_minor * 100, 1)

    largest = max(rows, key=lambda r: r["amount_minor"]) if rows else None

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "total": to_major(total_minor),
        "count": count,
        "average": to_major(round(total_minor / count)) if count else 0.0,
        "daily_average": to_major(round(total_minor / days)) if days else 0.0,
        "area_count": len(areas),
        "top_area": areas[0] if areas else None,
        "largest_receipt": {
            "name": largest["name"],
            "total": to_major(largest["amount_minor"]),
            "date": largest["date"],
        } if largest else None,
        "previous_total": to_major(previous_total_minor) if previous_total_minor is not None else None,
        "change_pct": change_pct,
        "areas": areas,
        "chart_areas": fold_tail(areas),
        "series": _series(rows, start, end),
    }


def previous_period(start: dt.date, end: dt.date) -> tuple[dt.date, dt.date]:
    """The equally long window immediately before ``start``."""
    span = (end - start).days + 1
    prev_end = start - dt.timedelta(days=1)
    return prev_end - dt.timedelta(days=span - 1), prev_end


def rows_to_json(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [{
        "id": r["id"],
        "name": r["name"],
        "amount": to_major(r["amount_minor"]),
        "date": r["date"],
    } for r in rows]
