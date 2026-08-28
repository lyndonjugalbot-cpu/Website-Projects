"""Command-line entry point.

Examples
--------
    python -m ssktool data/Products-Sold-July-2026.xls
    python -m ssktool data/*.xls --inventory inventory.csv --config config.json
    python -m ssktool data/Products-Sold-July-2026.xls --growth 1.1 --season 1.3 \
        --lead-time 10 --safety-days 14 --out output
"""

from __future__ import annotations

import argparse
import calendar
import datetime as dt
import glob
import json
import sys
from pathlib import Path

from .inventory import load_inventory
from .model import DEFAULT_CONFIG, build_recommendations
from .parser import load_period
from .report import write_csv, write_html, write_purchase_order_csv


def _expand(patterns: list[str]) -> list[Path]:
    files: list[Path] = []
    for pat in patterns:
        hits = [Path(p) for p in glob.glob(pat)]
        files.extend(hits or [Path(pat)])
    uniq = sorted({f.resolve() for f in files})
    missing = [f for f in uniq if not f.exists()]
    if missing:
        sys.exit(f"error: file(s) not found: {', '.join(map(str, missing))}")
    return uniq


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="ssktool",
        description="Forecast demand and recommend supplier orders from POS "
                    "'Sales by Product' exports.")
    p.add_argument("sales", nargs="+",
                   help="One or more sales exports (.xls SpreadsheetML or .csv). "
                        "Pass several months to get a trend-based forecast.")
    p.add_argument("--inventory", metavar="CSV",
                   help="Optional inventory/supplier master "
                        "(code,on_hand,on_order,pack_size,moq,unit_cost,supplier,lead_time_days)")
    p.add_argument("--config", metavar="JSON", help="Override planning parameters.")
    p.add_argument("--out", default="output", metavar="DIR",
                   help="Output directory (default: ./output)")
    p.add_argument("--target-month", type=int, metavar="1-12",
                   help="Month you are ordering for (default: month after latest sales).")
    # quick inline overrides
    p.add_argument("--growth", type=float, help="Month-on-month growth factor, e.g. 1.1")
    p.add_argument("--season", type=float, help="Seasonality multiplier for the target month.")
    p.add_argument("--horizon", type=int, help="Forecast/order horizon in days.")
    p.add_argument("--lead-time", type=int, help="Supplier lead time in days.")
    p.add_argument("--review-period", type=int, help="Days between orders to this supplier.")
    p.add_argument("--safety-days", type=int, help="Safety stock expressed in days of demand.")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    cfg = dict(DEFAULT_CONFIG)
    if args.config:
        cfg.update(json.loads(Path(args.config).read_text(encoding="utf-8")))
    if args.growth is not None:
        cfg["growth_factor"] = args.growth
    if args.horizon is not None:
        cfg["forecast_period_days"] = args.horizon
    if args.lead_time is not None:
        cfg["lead_time_days"] = args.lead_time
    if args.review_period is not None:
        cfg["review_period_days"] = args.review_period
    if args.safety_days is not None:
        cfg["safety_stock_days"] = args.safety_days

    periods = [load_period(f) for f in _expand(args.sales)]
    periods.sort(key=lambda p: p.start)
    latest = periods[-1]

    target_month = args.target_month
    if target_month is None:
        target_month = (latest.end + dt.timedelta(days=1)).month
    if args.season is not None:
        cfg.setdefault("seasonality", {})[str(target_month)] = args.season

    inventory = load_inventory(args.inventory) if args.inventory else None

    recs = build_recommendations(periods, inventory, cfg, target_month)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stamp = latest.label
    write_csv(recs, out / f"analysis_{stamp}.csv")
    write_purchase_order_csv(recs, out / f"purchase_order_{stamp}.csv")
    html_path = out / f"forecast_{stamp}.html"
    write_html(recs, html_path,
               period_label=" + ".join(p.label for p in periods),
               company=latest.company,
               target_month_name=calendar.month_name[target_month],
               config=cfg)

    order_lines = [r for r in recs if r.suggested_order_units > 0]
    units = sum(r.suggested_order_units for r in order_lines)
    cost = sum(r.est_order_cost for r in order_lines)

    print(f"Company           : {latest.company}")
    print(f"Sales periods     : {', '.join(p.label for p in periods)} "
          f"({'multi-month trend' if len(periods) > 1 else 'single month - projection only'})")
    print(f"Planning for      : {calendar.month_name[target_month]}")
    print(f"Products analysed : {len(recs)}")
    print(f"Lines to order    : {len(order_lines)}  ({units:,.0f} units"
          + (f", est. {cfg['currency']} {cost:,.0f}" if cost else "") + ")")
    print()
    print("Top 15 recommended orders:")
    print(f"  {'code':>5}  {'product':40.40}  {'sold':>5}  {'order':>6}  class")
    for r in sorted(order_lines, key=lambda r: -r.suggested_order_units)[:15]:
        print(f"  {r.code:>5}  {r.product:40.40}  {r.units_sold_latest:5.0f}  "
              f"{r.suggested_order_units:6.0f}  {r.abc_class}/{r.movement_class}")
    print()
    print(f"Written to {out}/:")
    print(f"  - forecast_{stamp}.html        (open in a browser)")
    print(f"  - analysis_{stamp}.csv         (every product, all metrics)")
    print(f"  - purchase_order_{stamp}.csv   (just the lines to buy)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
