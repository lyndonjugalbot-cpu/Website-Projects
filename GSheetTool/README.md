# GSheetTool

Take a contact list held in a Google Sheet, a CSV, or an `.xlsx` file and
combine each row's **`First Name` + `Last Name`** into one **`Full Name`**
column (`Derek` + `Keen` → `Derek Keen`).

Every other column — phone, email, postcode, anything — is **passed through
byte-for-byte unchanged**. The tool only writes the combined-name column.

## Name-column detection

Columns are found from the header row, case-insensitively. First name matches
`First Name` / `First` / `FName` / `Given Name` and the very common typo
`Frist Name`; last name matches `Last Name` / `Last` / `LName` / `Surname` /
`Family Name`. Compound headers such as `LicenseFirstName` are **not** matched
(that would grab the wrong column) — pass an override if you actually want one.

If detection is wrong or the sheet has no headers, force it: web app *Advanced*
fields, `--first-col` / `--last-col` on the CLI, or the `CONFIG` block in the
Apps Script. Each accepts a header name, a column letter (`C`), or a 1-based
number (`3`). The combined name goes to a new `Full Name` column unless one
already exists (or you point `--name-col` / *Combined-name column* elsewhere).

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
name-combining rule as the Python and Apps Script versions.

Deploy / redeploy (Vercel project `gsheettool`, root dir `web/`):

```bash
cd web && vercel deploy --prod
```

### Apps Script

1. In the sheet: **Extensions → Apps Script**.
2. Replace the contents with `apps-script/Code.gs`, **Save**, reload the sheet.
3. New **GSheet Tool** menu → **Preview (no changes)** to check the detected
   columns and counts → **Combine names** to apply.

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
  --first-col "Frist Name" --last-col "Surname" --out cleaned.csv

# write the combined names back into the sheet
python python/gsheet_tool.py --url "<link>" \
  --write --service-account service.json
```

An analysis report prints to **stderr** (rows scanned, name columns detected,
names combined, first few results). Add `--report json` for a machine-readable
version. The cleaned CSV goes to `--out`, or stdout if omitted.

## Tests

```bash
cd python && python -m unittest -v
```

Covers the name-combining edge cases (blank parts, whitespace) and the `.xlsx`
reader (shared / inline strings, bare numbers, date serials, sparse rows, sheet
selection). `python/sample_contacts.csv` is a ready demo input.

## Notes / limits

- `--url` (no service account) requires the sheet to be **"Anyone with the link
  – Viewer"** or **Published to the web**. A private sheet returns an HTML login
  page; the tool detects this and tells you to switch to Apps Script or a
  service account.
- Only the name columns are touched. Phone, email and every other column are
  written out exactly as they came in (no reformatting, no apostrophe stripping,
  no number coercion).
- The combined-name column is **appended** (Python) or created if missing
  (Apps Script); existing columns are not deleted. Use `--name-col "First Name"`
  to overwrite an existing column instead.
- `.xlsx` input is **read-only** — the cleaned data comes back as CSV, the
  original file is never modified (so `--in-place` does not apply). Only the
  modern `.xlsx` format is supported, not the legacy binary `.xls`. Formulas
  are read as their last-calculated value; cell formatting is not preserved.
