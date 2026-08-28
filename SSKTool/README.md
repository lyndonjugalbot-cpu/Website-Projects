# SSKTool — purchase forecast & order recommendations

Turns the POS **"Sales by Product"** export into a demand forecast and a
supplier order recommendation for the coming month.

Two front ends, one engine:

| | |
|---|---|
| **Web app** (`webapp/index.html`) | drag-and-drop up to **3** monthly exports + an optional `inventory.csv`, tune the parameters, get an on-screen report and downloadable CSVs. Runs 100% in the browser — no server, no upload. |
| **CLI** (`python -m ssktool`) | same math, scriptable, writes HTML + CSV files. Pure Python 3.10+ stdlib, no install. |

## Web app

```
# from the SSKTool folder
python3 -m http.server 8000
# open http://localhost:8000/webapp/
```

Opening `webapp/index.html` directly with `file://` also works — you just have
to pick the files by hand (the "Load sample" button needs the local server).

### Deploy to Vercel

The app is fully static — no build step. Two `vercel.json` files are included so
it works whichever **Root Directory** you set for the Vercel project:

| Root Directory | Config used | Serves |
|---|---|---|
| `SSKTool/webapp` *(recommended)* | `webapp/vercel.json` | the folder as-is |
| `SSKTool` | `SSKTool/vercel.json` | `outputDirectory: webapp` |

**Dashboard:** New Project → import the `Website-Projects` repo → set Root
Directory as above → Framework Preset **Other** → Deploy.

**CLI:** `cd SSKTool/webapp && npx vercel --prod` (or run from `SSKTool`).

1. **Drop 1–3 sales exports.** One file → projection. Two or three months →
   trend forecast with per-product growth/decline detection.
2. **Optionally drop `inventory.csv`** so quantities are net of stock and the PO
   shows real cost.
3. **Adjust parameters** (lead time, safety days, growth, seasonality, target
   month) and click **Analyze & forecast**.
4. Read the table; **Download purchase order CSV** (lines to buy, by supplier)
   or **full analysis CSV** (every product, every metric).

## CLI

```
python -m ssktool data/Products-Sold-July-2026.xls
```

Outputs land in `./output/`:

| file | what it is |
|------|------------|
| `forecast_<period>.html` | readable report — open in a browser |
| `analysis_<period>.csv` | every product, every metric |
| `purchase_order_<period>.csv` | just the lines to buy, grouped by supplier |

## What it does

1. **Parse** the POS file (it's SpreadsheetML XML, not a binary `.xls`) — code,
   product, quantity, revenue. Page-break headers and the grand-total row are
   ignored. A normalized CSV works too.
2. **Demand** — average daily demand (ADD) = units sold ÷ days in the period.
3. **Forecast** for the planning horizon:
   `ADD × horizon × growth × seasonality`.
   One month → projection. Several months (pass multiple files) → recency-weighted
   average + linear trend.
4. **Order recommendation** (periodic-review model):
   * reorder point `ROP = ADD × lead_time + safety_stock`
   * order-up-to `S = ADD × (lead_time + review_period) + safety_stock`
   * suggested order `= S − on_hand − on_order`, rounded up to pack size, floored at MOQ
   * `safety_stock = ADD × safety_stock_days`
5. **Classify** — ABC by revenue share (A ≤80 %, B ≤95 %, C rest); movement
   tier (fast / medium / slow / minimal) by units per 30 days.
6. **Flag** — single-month projection, no stock data, non-orderable
   services (e.g. *Cooking Charge*, *Chopsticks*), long-tail 1–2 unit sellers,
   declining/growing items, and "stock already above target".

## Inventory data (optional but recommended)

Without it, order quantities assume **zero stock on hand**. Provide a CSV:

```
code,on_hand,on_order,pack_size,moq,unit_cost,supplier,lead_time_days
183,40,0,10,10,58,Samyang Distributor,14
685,300,0,24,0,11,Coca-Cola PH,5
```

All columns except `code` are optional. See `examples/inventory.example.csv`.

```
python -m ssktool data/Products-Sold-July-2026.xls --inventory inventory.csv
```

## Tuning

Edit `config.example.json`, pass it with `--config`, or use inline flags:

```
python -m ssktool data/*.xls \
  --inventory inventory.csv \
  --growth 1.10 \        # expect +10% month on month
  --season 1.30 \        # target month runs 30% hot (e.g. December)
  --horizon 30 \
  --lead-time 10 \
  --review-period 30 \
  --safety-days 14 \
  --target-month 8
```

| key / flag | meaning | default |
|---|---|---|
| `forecast_period_days` / `--horizon` | days of cover this PO should buy | 30 |
| `lead_time_days` / `--lead-time` | PO → shelf | 7 |
| `review_period_days` / `--review-period` | days between orders to a supplier | 30 |
| `safety_stock_days` / `--safety-days` | buffer, in days of demand | 10 |
| `growth_factor` / `--growth` | blanket MoM growth (used only with 1 month) | 1.0 |
| `seasonality` / `--season` | multiplier for the target month | 1.0 |
| `movement_tiers` | fast/medium/slow cutoffs, units per 30 d | 20 / 6 / 1 |
| `non_orderable_patterns` | regexes for services never in a PO | see file |

## Improving the forecast

The single biggest upgrade is **more history**: save each month's export and
pass them all. Second: keep `inventory.csv` current so quantities are *net* of
stock and the PO cost is real.

## Layout

```
ssktool/
  parser.py     POS .xls / CSV → SalesPeriod
  inventory.py  inventory.csv → InventoryInfo
  model.py      forecasting + reorder math (all the knobs live here)
  report.py     CSV + HTML writers
  cli.py        argument handling, console summary
```
