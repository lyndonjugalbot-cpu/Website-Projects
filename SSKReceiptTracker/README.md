# SSK Receipt Tracker

A small Flask app for logging store receipts and turning them into a monthly
expense picture. Built for **Seoul Stop Kmart**: type in a receipt, pick a date
range, and see the total, the trend, and which area is eating the budget.

| Light | Dark |
|---|---|
| ![Light](docs/screenshot-light.png) | ![Dark](docs/screenshot-dark.png) |

## What it does

- **Three fields, nothing more** — receipt name, amount, date. That is the whole
  entry form.
- **Filter by date range** — five presets (this month, last month, last 90 days,
  year to date, all time) or any custom start/end. Every number and both charts
  follow the filter.
- **Spending by area** — receipts sharing a name are one *area* (`Meralco`,
  `meralco` and `MERALCO ` all roll up together), ranked largest first. The tail
  past the top 8 folds into a single "Other" bar rather than becoming noise.
- **Spending over time** — daily, weekly or monthly buckets, picked automatically
  from how long the range is, with empty periods drawn as zero rather than
  skipped.
- **Headline numbers** — total, receipt count, average receipt, the largest area,
  and the change against the equally long period immediately before.
- **Edit, delete, undo** — every delete offers a one-click undo.
- **CSV export** for the current range, ready to hand to a bookkeeper.
- Light and dark themes, keyboard-navigable charts, and a table view of every
  figure so no value is only reachable by hovering.

## Quick start

```bash
cd SSKReceiptTracker
python3 -m venv .venv && source .venv/bin/activate   # optional but recommended
pip install -r requirements.txt
python run.py
```

Open <http://127.0.0.1:5000>. The database is created on first run at
`instance/receipts.sqlite3`.

### Want sample data to look at first?

```bash
flask --app sskreceipts seed-db --months 8
```

That writes ~250 realistic receipts (suppliers, utilities, rent) into the same
database. Delete `instance/receipts.sqlite3` to start clean again.

## Configuration

Everything is an environment variable, all optional:

| Variable | Default | Purpose |
|---|---|---|
| `SSK_CURRENCY` | `PHP` | `PHP`, `USD`, `NZD`, `AUD`, `EUR`, `GBP`, `KRW` |
| `SSK_STORE_NAME` | `Seoul Stop Kmart` | Shown under the app name |
| `SSK_DATABASE` | `instance/receipts.sqlite3` | Path to the SQLite file |
| `SSK_HOST` / `SSK_PORT` | `127.0.0.1` / `5000` | Dev server binding |
| `SSK_DEBUG` | `1` | Set to `0` for a quiet server |

```bash
SSK_CURRENCY=NZD SSK_STORE_NAME="My Store" python run.py
```

## Running it for real

`run.py` starts Flask's development server, which is fine on a counter PC. For
anything longer-lived, put a WSGI server in front:

```bash
pip install waitress
waitress-serve --host 127.0.0.1 --port 8000 --call sskreceipts:create_app
```

The app has **no authentication** — it assumes a single trusted machine. Bind it
to `127.0.0.1` (the default) rather than exposing it on a network.

**Backups are one file.** Copy `instance/receipts.sqlite3` (plus any `-wal` /
`-shm` files beside it) and you have copied everything.

## Tests

```bash
python -m unittest discover -s tests -v
```

21 tests cover money parsing, field validation, the aggregations behind the
charts, and every API route including the error paths.

## How it is put together

```
sskreceipts/
├── __init__.py       app factory, page route, /healthz
├── config.py         env-var configuration, currency table
├── db.py             SQLite schema, queries, `init-db` / `seed-db` CLI
├── money.py          amount parsing; integer centavos, never floats
├── validation.py     name/date rules and the area grouping key
├── stats.py          aggregations: areas, time buckets, period comparison
├── api.py            JSON API + CSV export
├── templates/        the single page
└── static/
    ├── css/app.css   design tokens, light + dark
    └── js/
        ├── charts.js hand-rolled SVG bar + area charts
        └── app.js    fetching, rendering, form handling
```

Three decisions worth knowing about:

- **Amounts are integer centavos.** Binary floats cannot represent `0.10`, so a
  month of receipts summed as floats drifts. Parsing happens once, at the edge;
  everything inside is integer arithmetic.
- **The charts are hand-drawn SVG, not a charting library.** Two simple figures
  did not justify a dependency, and drawing them directly keeps the app fully
  offline and gives exact control over the marks.
- **One request per filter change.** `/api/dashboard` returns the receipts *and*
  every aggregate for a range, so the browser never re-derives a total the
  server already computed.

## A note on "areas"

The app groups spending by **receipt name** — that is what makes the "largest
area" answer work with only three input fields. Name receipts consistently
(`Fresh Produce Market` every time, not `produce` one week and `veg supplier` the
next) and the breakdown stays meaningful; the name box autocompletes from what
you have already used, ordered by how often you use it.

If you later want a separate category per receipt (so several vendors can roll
up into "Utilities"), that is a `category` column in `db.py`, a fourth form
field, and a second grouping key in `stats.py`.
