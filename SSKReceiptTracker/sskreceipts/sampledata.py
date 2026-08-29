"""Deterministic sample data, so a fresh clone has something to look at.

Modelled on a small grocery/convenience store: a few big recurring suppliers,
monthly utilities and rent, and a long tail of small one-offs.
"""

from __future__ import annotations

import datetime as dt
import random

from . import db
from .validation import group_key

# (name, typical amount, spread, roughly how many per month)
VENDORS: list[tuple[str, float, float, float]] = [
    ("Korean Grocery Wholesale", 18500, 4200, 4.0),
    ("Fresh Produce Market", 6400, 1800, 8.0),
    ("Meat & Seafood Supplier", 12800, 3100, 4.0),
    ("Beverage Distributor", 9200, 2400, 2.0),
    ("Frozen Goods Supplier", 7600, 1900, 2.0),
    ("Packaging & Supplies", 2100, 700, 2.0),
    ("Meralco Electricity", 14200, 2600, 1.0),
    ("Maynilad Water", 1850, 320, 1.0),
    ("Store Rent", 45000, 0, 1.0),
    ("Internet & Phone", 2499, 0, 1.0),
    ("Cleaning Supplies", 980, 300, 1.5),
    ("Equipment Repair", 3400, 1500, 0.4),
    ("Permits & Licences", 5200, 1800, 0.2),
    ("Delivery Fuel", 1450, 450, 3.0),
]


def seed(months: int = 6, seed_value: int = 20260828) -> int:
    rng = random.Random(seed_value)
    today = dt.date.today()
    rows: list[tuple[str, str, int, dt.date]] = []

    # Walk back `months` calendar months from the first of the current month.
    cursor = today.replace(day=1)
    starts: list[dt.date] = []
    for _ in range(months):
        starts.append(cursor)
        cursor = (cursor - dt.timedelta(days=1)).replace(day=1)

    for month_start in reversed(starts):
        next_month = (month_start.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        last_day = min(next_month - dt.timedelta(days=1), today)
        span = (last_day - month_start).days
        if span < 0:
            continue

        for name, mean, spread, per_month in VENDORS:
            # Partial current month: scale the count by how much of it has passed.
            scale = (span + 1) / ((next_month - month_start).days)
            count = int(per_month * scale) + (1 if rng.random() < (per_month * scale) % 1 else 0)
            for _ in range(count):
                amount = mean if spread == 0 else max(50.0, rng.gauss(mean, spread))
                day = month_start + dt.timedelta(days=rng.randint(0, span))
                rows.append((name, group_key(name), int(round(amount * 100)), day))

    db.bulk_insert(rows)
    return len(rows)
