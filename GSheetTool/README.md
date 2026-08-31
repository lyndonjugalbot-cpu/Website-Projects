# GSheetTool

Clean a contact list held in a Google Sheet, a CSV, or an `.xlsx` file:

1. **Combine names** — `First Name` + `Last Name` → one `Full Name` column
   (`John` + `Jargon` → `John Jargon`).
2. **Normalise phone numbers** to the plain local form `0XXXXXXXXX`.

## Phone rules

| Input            | Output         |
|------------------|----------------|
| `'02904343199`   | `02904343199`  |
| `'+642904343199` | `02904343199`  |
| `'2904343199`    | `02904343199`  |
| `'0290434319`    | `0290434319`   |

How it works: drop a leading text-forcing apostrophe, strip every non-digit,
then drop the leading `+64` / `0064` / `64` country code and any extra trunk
zeros, and finally put a single `0` back on the front. No spaces, brackets or
`+` in the output. Blank cells are left blank; anything with no recognisable
number is **left untouched and listed in the report** so you can fix it by
hand. Re-running is safe — a value already in the target format is not changed.

## Which piece to use

| Situation | Use |
|-----------|-----|
| Any machine, just a browser | **Web app → https://gsheettool.vercel.app** — paste the sheet link / CSV or upload a `.csv` / `.xlsx`, get a cleaned CSV back (`web/`) |
| The sheet is yours / you can open Apps Script | **`apps-script/Code.gs`** — cleans the sheet in place, no setup, no sharing changes |
| You just have a "anyone with the link" URL | `python/gsheet_tool.py --url ...` — pulls it via CSV export, writes a cleaned `.csv` |
| You have a service account with edit rights | `python/gsheet_tool.py --url ... --write --service-account key.json` — writes back into the sheet |
| You have a local CSV export | `python/gsheet_tool.py --csv file.csv --out cleaned.csv` |
| You have a local `.xlsx` file | `python/gsheet_tool.py --xlsx file.xlsx --out cleaned.csv` (add `--sheet "Name"` to pick a tab) |

### Web app (`web/`)

Live: **https://gsheettool.vercel.app**

Paste a Google Sheet link (shared *Anyone with the link → Viewer*) or CSV text,
or upload a `.csv` / `.xlsx` file, hit **Clean data**, then **Download cleaned
CSV** or **Copy for Google Sheets** (TSV → paste into cell A1). Column detection
is automatic; override it under *Advanced*. An `.xlsx` upload reads its first
worksheet unless you name another; the file is parsed in the serverless
function (a small built-in ZIP/OOXML reader, no third-party libraries). Nothing
is stored — each request cleans and returns.

Static page + one serverless function (`web/api/clean.js`) that fetches the
sheet server-side (avoids browser CORS) and runs `web/lib/clean.js` — the same
rules as the Python and Apps Script versions.

Deploy / redeploy (Vercel project `gsheettool`, root dir `web/`):

```bash
cd web && vercel deploy --prod
```

### Apps Script

1. In the sheet: **Extensions → Apps Script**.
2. Replace the contents with `apps-script/Code.gs`, **Save**, reload the sheet.
3. New **GSheet Tool** menu → **Preview (no changes)** to check the detected
   columns and counts → **Fix names + phone numbers** to apply.

Columns are auto-detected from the header row. No headers? Set the `CONFIG`
values at the top of the script to column letters (`'A'`) or 1-based numbers
(`'1'`), and `headerRow` to the row your titles sit on (or `1` if there are
none — row 1 is then treated as data only if you point the config at letters).

### Python CLI

Reading a link-shared sheet, a local CSV, or a local `.xlsx` needs **only the
standard library** (Python 3.9+). `--write` additionally needs:

```bash
pip install -r python/requirements.txt
```

Examples:

```bash
# link-shared sheet  ->  cleaned CSV
python python/gsheet_tool.py \
  --url "https://docs.google.com/spreadsheets/d/<id>/edit#gid=0" \
  --out cleaned.csv

# local CSV, overwrite in place
python python/gsheet_tool.py --csv contacts.csv --in-place

# local .xlsx  ->  cleaned CSV  (reads the first sheet, or --sheet "Name")
python python/gsheet_tool.py --xlsx contacts.xlsx --out cleaned.csv

# force which columns to use (name / letter / 1-based number all accepted)
python python/gsheet_tool.py --csv contacts.csv \
  --first-col "First Name" --last-col "Surname" --phone-col C --out cleaned.csv

# write back into the sheet
python python/gsheet_tool.py --url "<link>" \
  --write --service-account service.json
```

An analysis report prints to **stderr** (rows scanned, columns detected, phones
fixed / already-OK / unparseable, first few transformed rows). Add
`--report json` for a machine-readable version. The cleaned CSV goes to
`--out`, or stdout if omitted.

## Tests

```bash
cd python && python -m unittest -v
```

Covers all four brief scenarios plus spaced/dashed/`0064`/idempotent cases, the
name-combining edge cases, and the `.xlsx` reader (shared / inline strings,
bare numbers, date serials, sparse rows, sheet selection).
`python/sample_contacts.csv` is a ready demo input.

## Notes / limits

- `--url` (no service account) requires the sheet to be **"Anyone with the link
  – Viewer"** or **Published to the web**. A private sheet returns an HTML login
  page; the tool detects this and tells you to switch to Apps Script or a
  service account.
- The phone rule is New Zealand specific, matching the brief (local `0…` form).
  Other country numbers will be reshaped by the same digit rules and may not be
  meaningful — check the "unparseable" list and spot-check the output.
- The combined-name column is **appended** (Python) or created if missing
  (Apps Script); existing columns are not deleted. Use `--name-col "First Name"`
  to overwrite an existing column instead.
- `.xlsx` input is **read-only** — the cleaned data comes back as CSV, the
  original file is never modified (so `--in-place` does not apply). Only the
  modern `.xlsx` format is supported, not the legacy binary `.xls`. Formulas
  are read as their last-calculated value; cell formatting is not preserved.
