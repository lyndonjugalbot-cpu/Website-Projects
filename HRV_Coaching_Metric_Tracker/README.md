# HRV Coaching Log & Metric Tracker

A team-leader tool for a support/sales floor: record a coaching conversation
against an employee, attach the call it came from, enter that employee's weekly
numbers, and see whether the numbers moved afterwards.

Two roles, one login form:

| Role | Sees | Can do |
|---|---|---|
| **Team Leader / Admin** | Everyone | Write coaching logs, upload call recordings, enter weekly metrics, manage the roster |
| **Employee** | Only themselves | Read their own coaching logs, play the recordings attached to them, view their own metrics against the team average, acknowledge a log |

An employee cannot reach another employee's log, metric, or recording by any
route — including by asking for one by id. The restriction lives in the SQL
`WHERE` clause (`hrvcoach/auth.py` → `scope_uid`), not in a hidden button, and
`tests/test_app.py` asserts it from the outside.

## Run it

```bash
cd HRV_Coaching_Metric_Tracker
pip install -r requirements.txt
python run.py          # → http://127.0.0.1:5000
```

The first run creates the database and seeds a demo team, so the dashboard opens
onto working charts. **Password for every demo account: `coach1234`.**

| Sign in as | Role | What it shows |
|---|---|---|
| `TL-001` | Team Leader | The whole team; every control |
| `EMP-101` | Employee | Improving trends, two logs, one with a recording |
| `EMP-103` | Employee | Falling CSAT and QA against the team average — the case the tool exists for |
| `EMP-102` | Employee | A consistent top performer |

Set `HRV_SEED_DEMO=0` before the first run to start empty, then create the first
real account:

```bash
HRV_SEED_DEMO=0 flask --app run create-admin
```

## Run the tests

```bash
python -m pytest tests -q      # 41 tests, ~20s
```

Most of them exercise the role boundary and the upload path; the rest cover week
arithmetic, metric validation, and the shape of the chart payload.

## How it works

```
run.py                  local entry point
api/index.py            serverless entry point (same app)
hrvcoach/
  __init__.py           app factory, dashboard route, CLI commands
  auth.py               sign-in, sessions, the two roles, request scoping
  api.py                the JSON API the front end talks to
  db.py                 every SQL statement
  storage.py            SQLite ⇄ Postgres behind one interface; the schema
  metrics.py            the metric catalogue and ISO-week arithmetic
  validation.py         input rules, with messages written for the form
  recordings.py         upload sniffing, and Range-aware playback
  sampledata.py         the demo team
  templates/            login, dashboard shell
  static/js/charts.js   hand-rolled SVG charts (no charting library)
  static/js/app.js      the single-page front end (no framework)
```

### Metrics

Five metrics ship in `hrvcoach/metrics.py`: QA Score, CSAT, AHT, Attendance and
Sales Conversion. Each declares its unit, valid range, weekly target, and
**direction** — whether higher or lower is better. Direction is what stops the
dashboard lying: a falling AHT is an improvement, so every delta in the UI is
coloured by direction, never by the sign of the change.

Adding a sixth metric means adding one entry to that list. The entry form, the
chart grid, the KPI tiles, the table view and the API all read from it.

Values are stored one per employee, per metric, per **ISO week** (keyed by the
Monday). Any date you type snaps to its week's Monday, and re-saving a week
overwrites it — so a correction is just a re-save. A blank box *clears* that
metric for the week rather than storing `0`, which would read as a catastrophic
score on every chart.

### The charts

One line chart per metric — never one chart for all of them. QA is a percentage
and AHT is minutes; putting them on shared axes needs two y-scales, and the
alignment between two y-scales is arbitrary, so it invents correlations that are
not in the data. Small multiples instead.

- Blue is the person the dashboard is about; orange is the team average.
- A week with no reading is a **gap in the line**, not an interpolated point.
- Each chart is directly labelled with the latest value; the legend carries the
  second series, so identity never rests on colour alone.
- The palette is the validated data-viz default (checked for colour-vision
  separation and contrast against both the light and the dark surface). Dark
  mode uses steps selected for the dark surface, not an inversion.
- **Table** beside the **Charts** toggle shows the same numbers as text, for
  screen readers, for copying into a spreadsheet, and for anyone who would
  rather read than squint.

The `Range` control switches between 8, 12, 26 and 52 weeks.

### Call recordings

A coaching log takes an audio attachment: drag one onto the form, or attach it
to an existing log later. `.mp3 .m4a .mp4 .aac .wav .ogg .oga .opus .webm .flac
.amr`, up to **25 MB** (`HRV_MAX_RECORDING_BYTES`).

Three details worth knowing:

- **The browser's content type is a hint, not evidence.** The extension *and* a
  magic-number sniff both have to agree before a file is stored, and it is
  served back with the type from our own table plus `nosniff` — so a file
  cannot come back as HTML and run as a page on the app's own origin.
- **Recordings live in the database, not on disk.** A serverless host has no
  durable filesystem, so a file written there would be gone by the next
  request.
- **Playback supports `Range`**, so the scrubber in `<audio>` actually works
  rather than only playing from the start.

If an upload is rejected while you are creating a log, the **log is still
saved** — a bad attachment does not throw away a filled-in form. The recording
can be attached afterwards.

## Configuration

Every setting is an environment variable; none is required for a local run.

| Variable | Default | What it does |
|---|---|---|
| `HRV_SECRET_KEY` | random per process | Signs the session cookie. **Required in production** — see below. |
| `DATABASE_URL` | *(unset)* | Postgres URL. Unset ⇒ SQLite in `instance/`. |
| `HRV_DATABASE` | `instance/coaching.sqlite3` | Where the SQLite file lives. |
| `HRV_ORG_NAME` | `HRV Support` | Name in the header and page title. |
| `HRV_MAX_RECORDING_BYTES` | `26214400` (25 MB) | Upload cap. |
| `HRV_SEED_DEMO` | `1` | Seed the demo team into an empty database. |
| `HRV_HTTPS` | on when serverless | Sets `Secure` on the session cookie. |
| `HRV_PORT` / `HRV_HOST` / `HRV_DEBUG` | `5000` / `127.0.0.1` / `1` | Local dev server. |

`HRV_SECRET_KEY` is load-bearing: it is what stops a visitor forging an admin
session cookie. With none set, a local run generates a random key per process
(so a restart signs everyone out — the safe way to fail), and a serverless
deployment refuses to start rather than fall back to a shared default.

## Deploying

`vercel.json` and `api/index.py` are set up for Vercel with `@vercel/python`.
Two environment variables are needed before it will hold real data:

1. **Storage → Create Database → Neon (Postgres)**, connected to the project —
   that sets `DATABASE_URL`. Tables create themselves on the first request.
2. **Settings → Environment Variables → `HRV_SECRET_KEY`**, a long random value:
   `python -c "import secrets; print(secrets.token_hex(32))"`.

Miss either and the deployment serves a page explaining which one, instead of an
opaque 500.

One caveat specific to serverless hosts: **many cap the request body at ~4.5 MB**,
below this app's own 25 MB limit, so large recordings will be rejected by the
platform before Flask sees them. On such a host either lower
`HRV_MAX_RECORDING_BYTES` to match, or run the app somewhere with a normal
request limit (a container, a VM, `gunicorn` behind nginx) — nothing in the code
changes either way.

Anywhere else, it is an ordinary WSGI app:

```bash
pip install gunicorn
gunicorn "hrvcoach:create_app()" -b 0.0.0.0:8000
```

## Notes on scope

- **Acknowledgement is the one write an employee has.** It is scoped to their
  own log and touches only the acknowledgement timestamp — every other key in
  the request is ignored rather than half-applied. If you would rather employees
  had no writes at all, delete the non-admin branch in `api.py → edit_log`.
- **Passwords are set by the team leader** and hashed with Werkzeug's PBKDF2.
  There is no email, so no self-service reset — an admin sets a new one from the
  roster. Anyone can change their own from the account menu.
- **The last active admin cannot be demoted or deactivated**, so the tool cannot
  be locked away from everyone who administers it.
- Deleting a coaching log deletes its recordings with it, and says so before it
  does.
