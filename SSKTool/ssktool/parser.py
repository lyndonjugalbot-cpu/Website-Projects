"""Parser for the POS "Sales by Product" export.

The POS (FastReport) exports an ``.xls`` file that is really SpreadsheetML 2003
XML, not a binary Excel workbook. This module turns that file - or a plain CSV
with the same columns - into a list of :class:`SalesRow` records plus the
reporting period it covers.

Expected logical columns: Code, Product, Quantity, UOM, Total before tax, Total.
"""

from __future__ import annotations

import csv
import datetime as dt
import html
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class SalesRow:
    code: str
    product: str
    qty: float
    total: float
    uom: str = ""


@dataclass
class SalesPeriod:
    """A single period's worth of sales lines."""

    start: dt.date
    end: dt.date
    company: str
    rows: list[SalesRow]

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1

    @property
    def label(self) -> str:
        return f"{self.start:%Y-%m-%d}_{self.end:%Y-%m-%d}"


_CELL_RE = re.compile(r"<Cell([^>]*)>(.*?)</Cell>", re.S)
_ROW_RE = re.compile(r"<Row[^>]*>(.*?)</Row>", re.S)
_INDEX_RE = re.compile(r'ss:Index="(\d+)"')
_MERGE_RE = re.compile(r'ss:MergeAcross="(\d+)"')
_DATA_RE = re.compile(r"<Data[^>]*>(.*?)</Data>", re.S)
_PERIOD_RE = re.compile(r"(\d{1,2}/\d{1,2}/\d{4})\s*-\s*(\d{1,2}/\d{1,2}/\d{4})")

# Column positions in the SpreadsheetML export (1-based, after merge expansion).
COL_CODE = 1
COL_PRODUCT = 2
COL_QTY = 5
COL_UOM = 7
COL_TOTAL = 10


def _num(value: str) -> float | None:
    value = (value or "").strip().replace(",", "")
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _parse_spreadsheetml_rows(text: str) -> list[dict[int, str]]:
    rows: list[dict[int, str]] = []
    for row_body in _ROW_RE.findall(text):
        cells: dict[int, str] = {}
        idx = 1
        for attr, body in _CELL_RE.findall(row_body):
            m = _INDEX_RE.search(attr)
            if m:
                idx = int(m.group(1))
            data = _DATA_RE.search(body)
            cells[idx] = html.unescape(data.group(1)) if data else ""
            merge = _MERGE_RE.search(attr)
            idx += 1 + (int(merge.group(1)) if merge else 0)
        rows.append(cells)
    return rows


def _guess_period_from_name(path: Path) -> tuple[dt.date, dt.date]:
    """Fallback: infer a calendar month from a filename like ``...-July-2026``."""
    months = {m: i for i, m in enumerate(
        ["january", "february", "march", "april", "may", "june", "july",
         "august", "september", "october", "november", "december"], start=1)}
    name = path.stem.lower()
    year = None
    ym = re.search(r"(20\d{2})", name)
    if ym:
        year = int(ym.group(1))
    month = next((n for m, n in months.items() if m in name), None)
    if not (year and month):
        today = dt.date.today()
        year, month = today.year, today.month
    start = dt.date(year, month, 1)
    end = dt.date(year + (month == 12), (month % 12) + 1, 1) - dt.timedelta(days=1)
    return start, end


def parse_spreadsheetml(path: Path) -> SalesPeriod:
    text = path.read_text(encoding="utf-8", errors="replace")
    raw_rows = _parse_spreadsheetml_rows(text)

    start = end = None
    company = ""
    for cells in raw_rows:
        joined = " ".join(cells.values())
        pm = _PERIOD_RE.search(joined)
        if pm and start is None:
            start = dt.datetime.strptime(pm.group(1), "%m/%d/%Y").date()
            end = dt.datetime.strptime(pm.group(2), "%m/%d/%Y").date()
        if not company:
            for i, v in cells.items():
                if v.strip() == "Company:":
                    # company name sits in a later cell on the same row
                    later = [cells[k] for k in sorted(cells) if k > i and cells[k].strip()]
                    if later:
                        company = later[0].strip()
    if start is None or end is None:
        start, end = _guess_period_from_name(path)

    rows: list[SalesRow] = []
    for cells in raw_rows:
        code = (cells.get(COL_CODE, "") or "").strip()
        if not re.fullmatch(r"\d+", code):
            continue  # header, page-break timestamp, grand-total or blank row
        qty = _num(cells.get(COL_QTY, ""))
        total = _num(cells.get(COL_TOTAL, ""))
        if qty is None:
            continue
        rows.append(SalesRow(
            code=code,
            product=(cells.get(COL_PRODUCT, "") or "").strip(),
            qty=qty,
            total=total or 0.0,
            uom=(cells.get(COL_UOM, "") or "").strip(),
        ))
    return SalesPeriod(start=start, end=end, company=company or "Unknown", rows=rows)


def parse_csv(path: Path) -> SalesPeriod:
    """Parse a normalized CSV: code,product,qty,total[,uom] with optional
    ``# period: YYYY-MM-DD..YYYY-MM-DD`` and ``# company: ...`` comment lines."""
    start = end = None
    company = ""
    body_lines: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#"):
            pm = re.search(r"period:\s*(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})", line, re.I)
            if pm:
                start = dt.date.fromisoformat(pm.group(1))
                end = dt.date.fromisoformat(pm.group(2))
            cm = re.search(r"company:\s*(.+)", line, re.I)
            if cm:
                company = cm.group(1).strip()
            continue
        body_lines.append(line)
    if start is None:
        start, end = _guess_period_from_name(path)

    rows: list[SalesRow] = []
    reader = csv.DictReader(body_lines)
    for r in reader:
        lower = {(k or "").strip().lower(): (v or "") for k, v in r.items()}
        code = lower.get("code", "").strip()
        if not code:
            continue
        rows.append(SalesRow(
            code=code,
            product=lower.get("product", "").strip(),
            qty=_num(lower.get("qty") or lower.get("quantity") or "0") or 0.0,
            total=_num(lower.get("total") or "0") or 0.0,
            uom=lower.get("uom", "").strip(),
        ))
    return SalesPeriod(start=start, end=end, company=company or "Unknown", rows=rows)


def load_period(path: str | Path) -> SalesPeriod:
    path = Path(path)
    if path.suffix.lower() == ".csv":
        return parse_csv(path)
    head = path.read_text(encoding="utf-8", errors="replace")[:512].lstrip().lower()
    if head.startswith("<?xml") or "<workbook" in head:
        return parse_spreadsheetml(path)
    if head.startswith("code,") or "quantity" in head.split("\n")[0]:
        return parse_csv(path)
    raise ValueError(f"Unrecognized sales file format: {path}")
