#!/usr/bin/env python3
"""GSheetTool - read a Google Sheet (or CSV), combine first/last name into a
single "Full Name" column, and normalise phone numbers to the plain local
form ``0XXXXXXXXX`` (leading zero, no spaces; a leading apostrophe and any
``+64`` / ``0064`` / ``64`` country code are stripped).

Read a link-shared Google Sheet and write a cleaned CSV
--------------------------------------------------------
    python gsheet_tool.py \
        --url "https://docs.google.com/spreadsheets/d/<id>/edit#gid=0" \
        --out cleaned.csv

The sheet must be shared as "Anyone with the link - Viewer" (or Published to
the web) for this path - it is pulled through Google's CSV export endpoint, no
credentials required.

Clean a local CSV or .xlsx
--------------------------
    python gsheet_tool.py --csv contacts.csv --out cleaned.csv
    python gsheet_tool.py --csv contacts.csv --in-place
    python gsheet_tool.py --xlsx contacts.xlsx --out cleaned.csv
    python gsheet_tool.py --xlsx book.xlsx --sheet "Contacts" --out cleaned.csv

(.xlsx input is read-only - the cleaned data always comes back as CSV.)

Write the fixes back into the sheet
-----------------------------------
    python gsheet_tool.py --url "<link>" --write --service-account service.json

(requires ``pip install -r requirements.txt`` and a service account that has
edit access to the spreadsheet.)

An analysis report is always printed to stderr; add ``--report json`` for a
machine-readable version.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import urllib.request
from dataclasses import dataclass, field
from typing import List, Optional

from phone_rules import combine_name, try_normalise_phone
from xlsx_reader import XlsxError, read_xlsx

# --------------------------------------------------------------------------- #
# Column detection
# --------------------------------------------------------------------------- #

FIRST_NAME_PATTERNS = [
    r"^first[\s_]*name$", r"^f[\s_]*name$", r"^given[\s_]*name$",
    r"first\s*name", r"^first$", r"^fname$",
]
LAST_NAME_PATTERNS = [
    r"^last[\s_]*name$", r"^l[\s_]*name$", r"^surname$", r"^family[\s_]*name$",
    r"last\s*name", r"^last$", r"^lname$",
]
PHONE_PATTERNS = [
    r"phone", r"mobile", r"\bcell\b", r"contact.*(number|no\b)",
    r"^number$", r"telephone", r"\btel\b", r"msisdn",
]
NAME_TARGET_PATTERNS = [
    r"^full[\s_]*name$", r"^name$", r"^full$",
    r"^customer[\s_]*name$", r"^contact[\s_]*name$", r"^display[\s_]*name$",
]

DEFAULT_NAME_HEADER = "Full Name"

_SHEET_ID_RE = re.compile(r"/spreadsheets/d/([a-zA-Z0-9_-]+)")
_GID_RE = re.compile(r"[#&?]gid=([0-9]+)")


def sheet_csv_url(url: str, gid: Optional[str] = None) -> str:
    """Turn any Google Sheets URL into its CSV-export URL."""
    match = _SHEET_ID_RE.search(url)
    if not match:
        raise ValueError(f"not a Google Sheets URL: {url!r}")
    sheet_id = match.group(1)
    if gid is None:
        found = _GID_RE.search(url)
        gid = found.group(1) if found else "0"
    return (
        f"https://docs.google.com/spreadsheets/d/{sheet_id}"
        f"/export?format=csv&gid={gid}"
    )


def fetch_csv_rows(url: str) -> List[List[str]]:
    request = urllib.request.Request(url, headers={"User-Agent": "GSheetTool/1.0"})
    with urllib.request.urlopen(request) as response:  # noqa: S310 (trusted host)
        raw = response.read().decode("utf-8-sig")
    head = raw[:400].lstrip().lower()
    if head.startswith("<!doctype html") or "<html" in head:
        raise RuntimeError(
            "Google returned an HTML page instead of CSV - the sheet is not "
            "readable anonymously. Share it as 'Anyone with the link - Viewer', "
            "or use --write with a --service-account."
        )
    return list(csv.reader(io.StringIO(raw)))


def read_local_csv(path: str) -> List[List[str]]:
    with open(path, newline="", encoding="utf-8-sig") as handle:
        return list(csv.reader(handle))


# --------------------------------------------------------------------------- #
# Column resolution
# --------------------------------------------------------------------------- #

def _column_letter_to_index(spec: str) -> int:
    idx = 0
    for char in spec.upper():
        idx = idx * 26 + (ord(char) - ord("A") + 1)
    return idx - 1


def resolve_column(spec: Optional[str], headers: List[str]) -> Optional[int]:
    """Resolve a user-supplied column spec.

    Accepts a 1-based number ("3"), a spreadsheet column letter ("C"), an
    exact header name, or a case-insensitive substring of a header.
    """
    if spec is None:
        return None
    spec = str(spec).strip()
    if not spec:
        return None
    if spec.isdigit():
        return int(spec) - 1
    if re.fullmatch(r"[A-Za-z]{1,3}", spec):
        return _column_letter_to_index(spec)
    lowered = [h.strip().lower() for h in headers]
    if spec.lower() in lowered:
        return lowered.index(spec.lower())
    for i, header in enumerate(lowered):
        if spec.lower() in header:
            return i
    raise ValueError(f"column not found in header row: {spec!r}")


def detect_column(headers: List[str], patterns: List[str]) -> Optional[int]:
    for pattern in patterns:
        regex = re.compile(pattern, re.IGNORECASE)
        for i, header in enumerate(headers):
            if regex.search(header.strip()):
                return i
    return None


# --------------------------------------------------------------------------- #
# Transform
# --------------------------------------------------------------------------- #

@dataclass
class Report:
    source: str = ""
    worksheet_gid: Optional[str] = None
    total_rows: int = 0
    first_name_column: Optional[str] = None
    last_name_column: Optional[str] = None
    phone_column: Optional[str] = None
    full_name_column: Optional[str] = None
    full_name_column_created: bool = False
    names_combined: int = 0
    phones_fixed: int = 0
    phones_unchanged: int = 0
    phones_failed: List[str] = field(default_factory=list)
    samples: List[dict] = field(default_factory=list)

    def as_text(self) -> str:
        lines = [
            "GSheetTool - analysis",
            "=" * 40,
            f"Source            : {self.source}",
        ]
        if self.worksheet_gid is not None:
            lines.append(f"Worksheet gid     : {self.worksheet_gid}")
        lines += [
            f"Data rows         : {self.total_rows}",
            f"First-name column : {self.first_name_column or 'NOT FOUND'}",
            f"Last-name column  : {self.last_name_column or 'NOT FOUND'}",
            f"Phone column      : {self.phone_column or 'NOT FOUND'}",
            f"Full-name column  : {self.full_name_column}"
            + (" (created)" if self.full_name_column_created else ""),
            "-" * 40,
            f"Names combined    : {self.names_combined}",
            f"Phones fixed      : {self.phones_fixed}",
            f"Phones already OK : {self.phones_unchanged}",
            f"Phones unparseable: {len(self.phones_failed)}",
        ]
        for item in self.phones_failed[:25]:
            lines.append(f"    ! {item}")
        if len(self.phones_failed) > 25:
            lines.append(f"    ... and {len(self.phones_failed) - 25} more")
        if self.samples:
            lines.append("-" * 40)
            lines.append("First transformed rows:")
            for sample in self.samples:
                lines.append(f"    {sample}")
        return "\n".join(lines)


def transform(rows: List[List[str]], args: argparse.Namespace) -> tuple[List[List[str]], Report]:
    if not rows:
        raise SystemExit("error: the sheet/CSV is empty")

    report = Report(source=args.url or args.csv or args.xlsx or "?", worksheet_gid=args.gid)
    headers = [str(h).strip() for h in rows[0]]

    first_idx = (
        resolve_column(args.first_col, headers)
        if args.first_col else detect_column(headers, FIRST_NAME_PATTERNS)
    )
    last_idx = (
        resolve_column(args.last_col, headers)
        if args.last_col else detect_column(headers, LAST_NAME_PATTERNS)
    )
    phone_idx = (
        resolve_column(args.phone_col, headers)
        if args.phone_col else detect_column(headers, PHONE_PATTERNS)
    )

    # Resolve / create the combined-name column.
    name_created = False
    if args.name_col:
        try:
            name_idx = resolve_column(args.name_col, headers)
            if name_idx is None or name_idx >= len(headers):
                raise ValueError
        except ValueError:
            name_idx = len(headers)
            headers.append(args.name_col)
            name_created = True
    else:
        name_idx = detect_column(headers, NAME_TARGET_PATTERNS)
        if name_idx is None:
            name_idx = len(headers)
            headers.append(DEFAULT_NAME_HEADER)
            name_created = True

    width = len(headers)

    report.first_name_column = headers[first_idx] if first_idx is not None else None
    report.last_name_column = headers[last_idx] if last_idx is not None else None
    report.phone_column = headers[phone_idx] if phone_idx is not None else None
    report.full_name_column = headers[name_idx]
    report.full_name_column_created = name_created

    if first_idx is None or last_idx is None:
        print(
            "warning: could not identify both name columns - names will not be "
            "combined. Pass --first-col / --last-col.",
            file=sys.stderr,
        )
    if phone_idx is None:
        print(
            "warning: could not identify a phone column - pass --phone-col.",
            file=sys.stderr,
        )

    out_rows: List[List[str]] = [headers]
    for line_no, original in enumerate(rows[1:], start=2):
        row = list(original) + [""] * (width - len(original))
        report.total_rows += 1

        if first_idx is not None and last_idx is not None:
            full = combine_name(row[first_idx], row[last_idx])
            if full:
                if str(row[name_idx]).strip() != full:
                    report.names_combined += 1
                row[name_idx] = full

        if phone_idx is not None:
            value = "" if row[phone_idx] is None else str(row[phone_idx])
            fixed, status = try_normalise_phone(value)
            if status == "fixed":
                row[phone_idx] = fixed
                report.phones_fixed += 1
            elif status == "unchanged":
                report.phones_unchanged += 1
            elif status == "failed":
                report.phones_failed.append(f"row {line_no}: {value!r}")

        if len(report.samples) < 5 and (first_idx is not None or phone_idx is not None):
            report.samples.append(
                {
                    "row": line_no,
                    "name": row[name_idx] if name_idx < len(row) else "",
                    "phone": row[phone_idx] if phone_idx is not None else "",
                }
            )
        out_rows.append(row)

    return out_rows, report


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #

def write_csv(rows: List[List[str]], path: Optional[str]) -> None:
    if path:
        with open(path, "w", newline="", encoding="utf-8") as handle:
            csv.writer(handle).writerows(rows)
    else:
        csv.writer(sys.stdout).writerows(rows)


def write_back_to_sheet(rows: List[List[str]], url: str, gid: Optional[str],
                        service_account: str) -> None:
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "error: --write needs extra packages. Run:\n"
            "    pip install -r requirements.txt"
        ) from exc

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.readonly",
    ]
    creds = Credentials.from_service_account_file(service_account, scopes=scopes)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_url(url)

    worksheet = None
    if gid is not None:
        for candidate in spreadsheet.worksheets():
            if str(candidate.id) == str(gid):
                worksheet = candidate
                break
    worksheet = worksheet or spreadsheet.sheet1

    worksheet.resize(rows=max(len(rows), 1), cols=max(len(rows[0]), 1))
    worksheet.update(range_name="A1", values=rows, value_input_option="RAW")
    print(f"wrote {len(rows) - 1} rows back to worksheet '{worksheet.title}'",
          file=sys.stderr)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="gsheet_tool",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--url", help="Google Sheets share/edit link")
    source.add_argument("--csv", help="path to a local CSV file")
    source.add_argument("--xlsx", help="path to a local .xlsx file")

    parser.add_argument("--gid", help="worksheet gid (defaults to the one in the "
                                      "URL, else 0)")
    parser.add_argument("--sheet", help="worksheet name to read from an --xlsx "
                                        "(default: the first sheet)")
    parser.add_argument("--out", help="write cleaned CSV to this path "
                                      "(default: stdout)")
    parser.add_argument("--in-place", action="store_true",
                        help="overwrite the input --csv file")
    parser.add_argument("--write", action="store_true",
                        help="push the fixes back into the Google Sheet")
    parser.add_argument("--service-account",
                        help="service-account JSON key file (with --write)")

    parser.add_argument("--first-col", help="override first-name column "
                                            "(name, letter, or 1-based number)")
    parser.add_argument("--last-col", help="override last-name column")
    parser.add_argument("--phone-col", help="override phone column")
    parser.add_argument("--name-col", help="target column for the combined name "
                                           "(default: create 'Full Name')")

    parser.add_argument("--report", choices=["text", "json"], default="text",
                        help="report format on stderr (default: text)")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)

    if args.write and not args.url:
        raise SystemExit("error: --write requires --url")
    if args.write and not args.service_account:
        raise SystemExit("error: --write requires --service-account")
    if args.in_place and not args.csv:
        raise SystemExit("error: --in-place only applies to --csv")
    if args.sheet and not args.xlsx:
        raise SystemExit("error: --sheet only applies to --xlsx (use --gid for a Google Sheet)")

    if args.url:
        csv_url = sheet_csv_url(args.url, args.gid)
        print(f"fetching {csv_url}", file=sys.stderr)
        rows = fetch_csv_rows(csv_url)
    elif args.xlsx:
        try:
            rows = read_xlsx(args.xlsx, args.sheet)
        except XlsxError as exc:
            raise SystemExit(f"error: {exc}")
    else:
        rows = read_local_csv(args.csv)

    cleaned, report = transform(rows, args)

    if args.report == "json":
        print(json.dumps(report.__dict__, indent=2), file=sys.stderr)
    else:
        print(report.as_text(), file=sys.stderr)

    if args.write:
        write_back_to_sheet(cleaned, args.url, args.gid, args.service_account)
    elif args.in_place:
        write_csv(cleaned, args.csv)
        print(f"updated {args.csv} in place", file=sys.stderr)
    else:
        write_csv(cleaned, args.out)
        if args.out:
            print(f"wrote {args.out}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
