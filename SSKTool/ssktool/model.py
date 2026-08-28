"""Forecasting and purchase-recommendation logic.

Design notes
------------
* The POS export gives **monthly totals only** - no transaction dates, no
  on-hand stock. So the base signal is *average daily demand* (ADD) =
  units sold / days in the period.
* With a single month, the "forecast" is a projection: ADD x horizon x growth
  x seasonality. Drop more monthly exports into ``data/history/`` and the model
  switches to a recency-weighted average plus a linear trend, which is a real
  forecast.
* Ordering uses the classic periodic-review model:
      ROP (reorder point)   = ADD x lead_time_days + safety_stock
      S   (order-up-to)     = ADD x (lead_time_days + review_period_days) + safety_stock
      order qty             = max(0, S - on_hand - on_order)
  rounded up to the supplier pack size and floored at the MOQ.
* Without an ``inventory.csv`` we assume on_hand = on_order = 0 and the
  recommendation is the full order-up-to level, clearly flagged.
"""

from __future__ import annotations

import datetime as dt
import math
import re
import statistics
from dataclasses import dataclass, field, asdict

from .parser import SalesPeriod


DEFAULT_CONFIG: dict = {
    # Planning horizon for this purchase order (days of cover you want to buy).
    "forecast_period_days": 30,
    # Supplier lead time from PO to shelf.
    "lead_time_days": 7,
    # How often you place an order with this supplier.
    "review_period_days": 30,
    # Extra buffer, expressed as days of average demand.
    "safety_stock_days": 10,
    # Blanket month-on-month growth assumption (1.0 = flat).
    "growth_factor": 1.0,
    # Per-target-month multipliers, e.g. {"12": 1.3} for December.
    "seasonality": {},
    # Recency weights when multiple months are supplied (newest first).
    "history_weights": [0.5, 0.3, 0.2],
    # Movement tiers by units sold per 30 days.
    "movement_tiers": {"fast": 20, "medium": 6, "slow": 1},
    # Lines matching these (case-insensitive regexes) are services/consumables,
    # not things you reorder from the supplier - reported but never in the PO.
    "non_orderable_patterns": [
        r"cooking charge", r"\bcharge\b", r"chopstick", r"^cup only$",
        r"delivery", r"plastic bag", r"service", r"\bpax\b",
    ],
    # Round order quantities up to this multiple when no pack size is known.
    "default_pack_size": 1,
    "currency": "PHP",
}


@dataclass
class InventoryInfo:
    on_hand: float = 0.0
    on_order: float = 0.0
    pack_size: int = 1
    moq: int = 0
    unit_cost: float = 0.0
    supplier: str = ""
    lead_time_days: int | None = None
    known: bool = False


@dataclass
class Recommendation:
    code: str
    product: str
    uom: str
    # observed
    units_sold_latest: float
    revenue_latest: float
    months_observed: int
    avg_daily_demand: float
    trend_pct_per_month: float
    # derived
    forecast_units: float
    safety_stock_units: float
    reorder_point_units: float
    order_up_to_units: float
    on_hand: float
    on_order: float
    suggested_order_units: float
    suggested_order_packs: float
    pack_size: int
    est_order_cost: float
    # labels
    abc_class: str
    movement_class: str
    supplier: str
    flags: list[str] = field(default_factory=list)

    def as_row(self) -> dict:
        d = asdict(self)
        d["flags"] = "; ".join(self.flags)
        for k, v in d.items():
            if isinstance(v, float):
                d[k] = round(v, 2)
        return d


def _seasonality_factor(cfg: dict, target_month: int) -> float:
    table = cfg.get("seasonality") or {}
    return float(table.get(str(target_month), table.get(target_month, 1.0)))


def _is_non_orderable(name: str, cfg: dict) -> bool:
    return any(re.search(p, name, re.I) for p in cfg.get("non_orderable_patterns", []))


def _movement_class(units_per_30: float, cfg: dict) -> str:
    tiers = cfg["movement_tiers"]
    if units_per_30 >= tiers["fast"]:
        return "fast"
    if units_per_30 >= tiers["medium"]:
        return "medium"
    if units_per_30 >= tiers["slow"]:
        return "slow"
    return "minimal"


@dataclass
class _Series:
    code: str
    product: str
    uom: str
    # oldest -> newest
    periods: list[tuple[dt.date, dt.date]] = field(default_factory=list)
    qty: list[float] = field(default_factory=list)
    revenue: list[float] = field(default_factory=list)


def _build_series(periods: list[SalesPeriod]) -> dict[str, _Series]:
    periods = sorted(periods, key=lambda p: p.start)
    series: dict[str, _Series] = {}
    for p in periods:
        seen: set[str] = set()
        by_code: dict[str, tuple[float, float, str, str]] = {}
        for r in p.rows:
            q, t, _, _ = by_code.get(r.code, (0.0, 0.0, "", ""))
            by_code[r.code] = (q + r.qty, t + r.total, r.product, r.uom)
        for code, (q, t, name, uom) in by_code.items():
            s = series.setdefault(code, _Series(code=code, product=name, uom=uom))
            s.product, s.uom = name or s.product, uom or s.uom
            s.periods.append((p.start, p.end))
            s.qty.append(q)
            s.revenue.append(t)
            seen.add(code)
        # carry non-selling months as zero so trend/averages are honest
        for code, s in series.items():
            if code not in seen and len(s.qty) < len([x for x in periods if x.start <= p.start]):
                s.periods.append((p.start, p.end))
                s.qty.append(0.0)
                s.revenue.append(0.0)
    return series


def _daily_demand_per_month(s: _Series) -> list[float]:
    out = []
    for (start, end), q in zip(s.periods, s.qty):
        days = (end - start).days + 1
        out.append(q / days if days else 0.0)
    return out


def _weighted_add_and_trend(dd: list[float], weights: list[float]) -> tuple[float, float]:
    """Return (blended avg daily demand, % change per month)."""
    if not dd:
        return 0.0, 0.0
    if len(dd) == 1:
        return dd[0], 0.0
    newest_first = list(reversed(dd))
    w = (weights + [weights[-1]] * len(newest_first))[: len(newest_first)]
    wsum = sum(w) or 1.0
    add = sum(v * wi for v, wi in zip(newest_first, w)) / wsum
    # simple least-squares slope over month index 0..n-1 (oldest->newest)
    n = len(dd)
    xs = list(range(n))
    mx = statistics.fmean(xs)
    my = statistics.fmean(dd)
    denom = sum((x - mx) ** 2 for x in xs) or 1.0
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, dd)) / denom
    base = my or 1.0
    return add, (slope / base) * 100.0


def build_recommendations(
    periods: list[SalesPeriod],
    inventory: dict[str, InventoryInfo] | None = None,
    config: dict | None = None,
    target_month: int | None = None,
) -> list[Recommendation]:
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    inventory = inventory or {}
    latest = max(periods, key=lambda p: p.start)
    if target_month is None:
        nm = latest.end + dt.timedelta(days=1)
        target_month = nm.month

    series = _build_series(periods)
    horizon = cfg["forecast_period_days"]
    season = _seasonality_factor(cfg, target_month)
    growth = cfg["growth_factor"]

    # revenue for ABC uses the latest month only
    latest_rev = {}
    for r in latest.rows:
        latest_rev[r.code] = latest_rev.get(r.code, 0.0) + r.total
    ranked = sorted(latest_rev.items(), key=lambda kv: kv[1], reverse=True)
    total_rev = sum(latest_rev.values()) or 1.0
    abc: dict[str, str] = {}
    cum = 0.0
    for code, rev in ranked:
        cum += rev
        share = cum / total_rev
        abc[code] = "A" if share <= 0.80 else "B" if share <= 0.95 else "C"

    recs: list[Recommendation] = []
    for code, s in series.items():
        dd = _daily_demand_per_month(s)
        add, trend = _weighted_add_and_trend(dd, cfg["history_weights"])
        months = len([q for q in s.qty])
        # apply explicit growth on top of observed trend only when we have 1 month
        eff_growth = growth if months == 1 else 1.0

        inv = inventory.get(code, InventoryInfo())
        lead = inv.lead_time_days or cfg["lead_time_days"]
        review = cfg["review_period_days"]

        forecast_units = add * horizon * eff_growth * season
        safety_units = add * cfg["safety_stock_days"]
        rop = add * lead + safety_units
        order_up_to = add * (lead + review) * eff_growth * season + safety_units

        pack = inv.pack_size or cfg["default_pack_size"] or 1
        raw_need = max(0.0, order_up_to - inv.on_hand - inv.on_order)
        packs = math.ceil(raw_need / pack) if raw_need > 0 else 0
        if packs and inv.moq:
            packs = max(packs, math.ceil(inv.moq / pack))
        order_units = packs * pack

        units_sold_latest = 0.0
        revenue_latest = latest_rev.get(code, 0.0)
        for (start, _), q, rev in zip(s.periods, s.qty, s.revenue):
            if start == latest.start:
                units_sold_latest = q

        units_per_30 = add * 30.0
        movement = _movement_class(units_per_30, cfg)

        flags: list[str] = []
        if not inv.known:
            flags.append("no stock data - qty assumes 0 on hand")
        if _is_non_orderable(s.product, cfg):
            flags.append("non-orderable (service/consumable) - excluded from PO")
            order_units = packs = 0
        if months == 1:
            flags.append("single month - projection only, not a true forecast")
        if units_sold_latest <= 2 and movement in ("slow", "minimal"):
            flags.append("long-tail - consider buy-to-order or delist")
        if trend <= -25 and months >= 2:
            flags.append(f"declining ~{trend:.0f}%/mo")
        if trend >= 25 and months >= 2:
            flags.append(f"growing ~{trend:.0f}%/mo")
        if inv.known and inv.on_hand + inv.on_order >= order_up_to and units_per_30 > 0:
            flags.append("stock above target - no order needed")

        recs.append(Recommendation(
            code=code,
            product=s.product,
            uom=s.uom,
            units_sold_latest=units_sold_latest,
            revenue_latest=revenue_latest,
            months_observed=months,
            avg_daily_demand=add,
            trend_pct_per_month=trend,
            forecast_units=forecast_units,
            safety_stock_units=safety_units,
            reorder_point_units=rop,
            order_up_to_units=order_up_to,
            on_hand=inv.on_hand,
            on_order=inv.on_order,
            suggested_order_units=order_units,
            suggested_order_packs=packs,
            pack_size=pack,
            est_order_cost=order_units * inv.unit_cost,
            abc_class=abc.get(code, "C"),
            movement_class=movement,
            supplier=inv.supplier,
            flags=flags,
        ))

    recs.sort(key=lambda r: (r.supplier or "~", {"A": 0, "B": 1, "C": 2}[r.abc_class],
                             -r.suggested_order_units, r.product.lower()))
    return recs
