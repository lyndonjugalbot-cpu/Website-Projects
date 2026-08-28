"""CSV + standalone HTML output for a set of recommendations."""

from __future__ import annotations

import csv
import datetime as dt
import html
import io

from .model import Recommendation


CSV_FIELDS = [
    "supplier", "code", "product", "uom", "abc_class", "movement_class",
    "months_observed", "units_sold_latest", "revenue_latest", "avg_daily_demand",
    "trend_pct_per_month", "forecast_units", "safety_stock_units",
    "reorder_point_units", "order_up_to_units", "on_hand", "on_order",
    "pack_size", "suggested_order_packs", "suggested_order_units",
    "est_order_cost", "flags",
]


def write_csv(recs: list[Recommendation], path) -> None:
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in recs:
            w.writerow(r.as_row())


def write_purchase_order_csv(recs: list[Recommendation], path) -> None:
    """Just the lines to actually buy, grouped by supplier."""
    rows = [r for r in recs if r.suggested_order_units > 0]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["supplier", "code", "product", "order_packs", "pack_size",
                    "order_units", "est_cost", "reason"])
        for r in rows:
            w.writerow([r.supplier, r.code, r.product, r.suggested_order_packs,
                        r.pack_size, r.suggested_order_units, round(r.est_order_cost, 2),
                        f"{r.movement_class}/{r.abc_class}; sold {r.units_sold_latest:g} last month"])


def _fmt(n: float, dp: int = 1) -> str:
    return f"{n:,.{dp}f}"


def write_html(recs: list[Recommendation], path, *, period_label: str,
               company: str, target_month_name: str, config: dict) -> None:
    order_lines = [r for r in recs if r.suggested_order_units > 0]
    total_cost = sum(r.est_order_cost for r in order_lines)
    have_cost = any(r.est_order_cost for r in order_lines)
    cur = config.get("currency", "")

    by_class = {c: [r for r in recs if r.abc_class == c] for c in "ABC"}
    dead = [r for r in recs if r.movement_class == "minimal"]
    longtail = [r for r in recs if "long-tail" in " ".join(r.flags)]

    def esc(x) -> str:
        return html.escape(str(x))

    def table(rows: list[Recommendation]) -> str:
        body = io.StringIO()
        for r in rows:
            flag_html = ""
            if r.flags:
                flag_html = "<br>".join(
                    f'<span class="flag">{esc(f)}</span>' for f in r.flags)
            body.write(f"""<tr>
<td>{esc(r.code)}</td>
<td class="prod">{esc(r.product)}{('<br>' + flag_html) if flag_html else ''}</td>
<td class="c">{esc(r.abc_class)}</td>
<td class="c">{esc(r.movement_class)}</td>
<td class="n">{_fmt(r.units_sold_latest, 0)}</td>
<td class="n">{_fmt(r.avg_daily_demand, 2)}</td>
<td class="n">{_fmt(r.trend_pct_per_month, 0)}%</td>
<td class="n">{_fmt(r.forecast_units, 0)}</td>
<td class="n">{_fmt(r.reorder_point_units, 0)}</td>
<td class="n">{_fmt(r.order_up_to_units, 0)}</td>
<td class="n">{_fmt(r.on_hand, 0)}</td>
<td class="n strong">{_fmt(r.suggested_order_units, 0)}</td>
<td class="n">{(cur + ' ' + _fmt(r.est_order_cost, 2)) if r.est_order_cost else '&mdash;'}</td>
</tr>""")
        return body.getvalue()

    generated = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Order forecast &mdash; {esc(company)}</title>
<style>
  :root {{ color-scheme: light dark; }}
  * {{ box-sizing: border-box; }}
  body {{ font: 14px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    margin: 0; padding: 2rem; background: #f6f7f9; color: #1b1f24; }}
  @media (prefers-color-scheme: dark) {{
    body {{ background: #14171c; color: #e6e8eb; }}
    .card, table {{ background: #1d2127 !important; }}
    th {{ background: #252b33 !important; }}
    tr:nth-child(even) td {{ background: #20252c !important; }}
  }}
  h1 {{ font-size: 1.4rem; margin: 0 0 .25rem; }}
  .sub {{ color: #6b7280; margin-bottom: 1.5rem; }}
  .cards {{ display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }}
  .card {{ background: #fff; border: 1px solid #e2e5e9; border-radius: 10px;
    padding: 1rem 1.25rem; min-width: 160px; }}
  .card .big {{ font-size: 1.6rem; font-weight: 700; }}
  .card .lbl {{ color: #6b7280; font-size: .8rem; text-transform: uppercase;
    letter-spacing: .04em; }}
  h2 {{ font-size: 1.05rem; margin: 2rem 0 .5rem; }}
  .wrap {{ overflow-x: auto; border: 1px solid #e2e5e9; border-radius: 10px; }}
  table {{ border-collapse: collapse; width: 100%; background: #fff; font-size: 13px; }}
  th, td {{ padding: .5rem .6rem; text-align: left; border-bottom: 1px solid #edeff2;
    white-space: nowrap; }}
  th {{ background: #f0f2f5; position: sticky; top: 0; font-size: 12px;
    text-transform: uppercase; letter-spacing: .03em; }}
  td.n {{ text-align: right; font-variant-numeric: tabular-nums; }}
  td.c {{ text-align: center; }}
  td.prod {{ white-space: normal; min-width: 240px; }}
  td.strong {{ font-weight: 700; }}
  .flag {{ display: inline-block; font-size: 11px; color: #8a5a00;
    background: #fff4e0; border-radius: 4px; padding: 1px 6px; margin-top: 2px; }}
  @media (prefers-color-scheme: dark) {{ .flag {{ color: #ffce8a; background: #3a2c10; }} }}
  details {{ margin-top: .5rem; }}
  summary {{ cursor: pointer; font-weight: 600; }}
  .note {{ background: #eef4ff; border-left: 3px solid #3b82f6; padding: .75rem 1rem;
    border-radius: 6px; margin: 1rem 0; }}
  @media (prefers-color-scheme: dark) {{ .note {{ background: #17263f; }} }}
</style></head><body>

<h1>Purchase forecast &amp; order recommendation</h1>
<div class="sub">{esc(company)} &nbsp;&middot;&nbsp; based on sales for {esc(period_label)}
 &nbsp;&middot;&nbsp; planning for <strong>{esc(target_month_name)}</strong>
 &nbsp;&middot;&nbsp; generated {generated}</div>

<div class="cards">
  <div class="card"><div class="lbl">Products analysed</div><div class="big">{len(recs)}</div></div>
  <div class="card"><div class="lbl">Lines to order</div><div class="big">{len(order_lines)}</div></div>
  <div class="card"><div class="lbl">Units to order</div><div class="big">{_fmt(sum(r.suggested_order_units for r in order_lines), 0)}</div></div>
  {'<div class="card"><div class="lbl">Est. PO cost</div><div class="big">' + esc(cur) + ' ' + _fmt(total_cost, 0) + '</div></div>' if have_cost else ''}
  <div class="card"><div class="lbl">Class A / B / C</div><div class="big">{len(by_class['A'])}/{len(by_class['B'])}/{len(by_class['C'])}</div></div>
</div>

<div class="note">
<strong>How to read this.</strong> <em>Forecast</em> = projected units for the
planning horizon ({config['forecast_period_days']} days), from average daily
sales &times; growth &times; seasonality. <em>Reorder point</em> = cover lead
time ({config['lead_time_days']} d) + safety stock ({config['safety_stock_days']}
d): order when stock hits this. <em>Order-up-to</em> is the target level after
the delivery lands. <em>Suggested order</em> = order-up-to &minus; on hand
&minus; on order, rounded to pack size. Provide <code>inventory.csv</code>
(on-hand, pack size, MOQ, unit cost, supplier) for accurate net quantities and
costs &mdash; without it, quantities assume zero stock on hand.
</div>

<h2>Recommended order &mdash; {len(order_lines)} lines</h2>
<div class="wrap"><table>
<thead><tr>
<th>Code</th><th>Product</th><th>ABC</th><th>Move</th><th>Sold</th><th>Units/day</th>
<th>Trend</th><th>Forecast</th><th>ROP</th><th>Order&nbsp;up&nbsp;to</th><th>On&nbsp;hand</th>
<th>Order</th><th>Est.&nbsp;cost</th>
</tr></thead>
<tbody>{table(order_lines)}</tbody>
</table></div>

<details><summary>All {len(recs)} products (full analysis)</summary>
<div class="wrap"><table>
<thead><tr>
<th>Code</th><th>Product</th><th>ABC</th><th>Move</th><th>Sold</th><th>Units/day</th>
<th>Trend</th><th>Forecast</th><th>ROP</th><th>Order&nbsp;up&nbsp;to</th><th>On&nbsp;hand</th>
<th>Order</th><th>Est.&nbsp;cost</th>
</tr></thead>
<tbody>{table(recs)}</tbody>
</table></div></details>

<h2>Watch list</h2>
<p><strong>Minimal movers ({len(dead)})</strong> &mdash; sold very little all
period; candidates to delist or buy only on request:
{esc(', '.join(r.product for r in dead[:60]) or 'none')}.</p>
<p><strong>Long tail ({len(longtail)})</strong> &mdash; 1&ndash;2 units last
month: {esc(', '.join(r.product for r in longtail[:60]) or 'none')}.</p>

</body></html>"""
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(doc)
