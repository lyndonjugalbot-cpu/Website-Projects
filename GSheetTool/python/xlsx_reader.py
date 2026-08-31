"""Minimal .xlsx reader for GSheetTool - standard library only.

An .xlsx file is a ZIP of XML parts. :func:`read_xlsx` pulls one worksheet out
of it as a list-of-rows-of-strings, enough for a contact list (text, numbers,
booleans, dates). It is not a full OOXML implementation.

Kept in sync with ../web/lib/xlsx.js.
"""

from __future__ import annotations

import datetime as _dt
import re
import zipfile
from typing import List, Optional
from xml.etree import ElementTree as ET

_BUILTIN_DATE_FMT = {14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47}
_EXCEL_EPOCH = _dt.datetime(1899, 12, 30)  # 1900 date system, incl. the leap bug


class XlsxError(ValueError):
    """Raised when a file cannot be read as an .xlsx workbook."""


def _localname(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _col_to_index(ref: str) -> int:
    letters = re.match(r"[A-Z]+", ref or "")
    if not letters:
        return 0
    idx = 0
    for ch in letters.group(0):
        idx = idx * 26 + (ord(ch) - 64)
    return idx - 1


def _text_of_run(elem: ET.Element) -> str:
    """Concatenate every <t> descendant (shared-string / inline-string runs)."""
    return "".join(
        node.text or "" for node in elem.iter() if _localname(node.tag) == "t"
    )


def _serial_to_str(raw: str) -> str:
    try:
        value = float(raw)
    except ValueError:
        return raw
    stamp = _EXCEL_EPOCH + _dt.timedelta(days=value)
    if value == int(value):
        return stamp.date().isoformat()
    return stamp.replace(microsecond=0).isoformat(sep=" ")


def _date_style_flags(styles_xml: Optional[bytes]) -> List[bool]:
    if not styles_xml:
        return []
    root = ET.fromstring(styles_xml)

    custom: dict[int, bool] = {}
    for fmt in root.iter():
        if _localname(fmt.tag) != "numFmt":
            continue
        fmt_id = int(fmt.attrib.get("numFmtId", "-1"))
        code = re.sub(r"\[[^\]]*]", "", fmt.attrib.get("formatCode", ""))
        code = re.sub(r'"[^"]*"', "", code)
        custom[fmt_id] = bool(re.search(r"[dy]", code, re.I) or "m" in code)

    flags: List[bool] = []
    for xfs in root.iter():
        if _localname(xfs.tag) != "cellXfs":
            continue
        for xf in xfs:
            fmt_id = int(xf.attrib.get("numFmtId", "0"))
            flags.append(fmt_id in _BUILTIN_DATE_FMT or custom.get(fmt_id, False))
        break
    return flags


def _sheet_target(zf: zipfile.ZipFile, sheet: Optional[str]) -> tuple[str, str, List[str]]:
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    defs = []
    for node in wb.iter():
        if _localname(node.tag) != "sheet":
            continue
        rid = ""
        for key, val in node.attrib.items():
            if _localname(key) == "id":
                rid = val
        defs.append((node.attrib.get("name", ""), rid))
    if not defs:
        raise XlsxError("workbook lists no worksheets")

    names = [d[0] for d in defs]
    chosen = defs[0]
    if sheet:
        want = sheet.strip().lower()
        match = next((d for d in defs if d[0].lower() == want), None)
        if match is None:
            raise XlsxError(
                f"worksheet {sheet!r} not found. Available: {', '.join(names)}"
            )
        chosen = match

    rel_target = {}
    try:
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        for rel in rels:
            rel_target[rel.attrib.get("Id", "")] = rel.attrib.get("Target", "")
    except KeyError:
        pass

    target = rel_target.get(chosen[1]) or f"worksheets/sheet{defs.index(chosen) + 1}.xml"
    target = target.lstrip("/")
    if not target.startswith("xl/"):
        target = "xl/" + target
    return chosen[0], target, names


def read_xlsx(path: str, sheet: Optional[str] = None) -> List[List[str]]:
    """Read *path* (an .xlsx file) and return the chosen worksheet as a grid.

    ``sheet`` picks a worksheet by name (case-insensitive); the first sheet is
    used by default.
    """
    try:
        zf = zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        raise XlsxError(f"{path!r} is not a valid .xlsx (not a ZIP archive)") from exc

    with zf:
        try:
            _, target, _names = _sheet_target(zf, sheet)
        except KeyError as exc:
            raise XlsxError(f"{path!r} is missing {exc} - it may be corrupt") from exc

        shared: List[str] = []
        try:
            sst = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            shared = [
                _text_of_run(si) for si in sst if _localname(si.tag) == "si"
            ]
        except KeyError:
            pass

        try:
            date_flags = _date_style_flags(zf.read("xl/styles.xml"))
        except KeyError:
            date_flags = []

        try:
            sheet_xml = zf.read(target)
        except KeyError as exc:
            raise XlsxError(f"worksheet part {target!r} not found in {path!r}") from exc

    root = ET.fromstring(sheet_xml)
    rows: List[List[str]] = []
    expected_row = 0

    for node in root.iter():
        if _localname(node.tag) != "row":
            continue
        row_num = int(node.attrib.get("r", expected_row + 1))
        while expected_row < row_num - 1:
            rows.append([])
            expected_row += 1
        expected_row = row_num

        cells: List[str] = []
        expected_col = 0
        for cell in node:
            if _localname(cell.tag) != "c":
                continue
            ref = cell.attrib.get("r", "")
            col = _col_to_index(ref) if ref else expected_col
            while len(cells) < col:
                cells.append("")
            expected_col = col + 1

            ctype = cell.attrib.get("t", "n")
            style_id = int(cell.attrib.get("s", "-1"))
            value = ""

            if ctype == "s":
                v = cell.find("./{*}v")
                if v is not None and v.text is not None:
                    idx = int(v.text)
                    value = shared[idx] if 0 <= idx < len(shared) else ""
            elif ctype == "inlineStr":
                is_node = cell.find("./{*}is")
                value = _text_of_run(is_node) if is_node is not None else ""
            elif ctype in ("str", "e"):
                v = cell.find("./{*}v")
                value = v.text or "" if v is not None else ""
            elif ctype == "b":
                v = cell.find("./{*}v")
                value = "TRUE" if (v is not None and (v.text or "").strip() == "1") else "FALSE"
            else:
                v = cell.find("./{*}v")
                raw = (v.text or "").strip() if v is not None else ""
                if raw and 0 <= style_id < len(date_flags) and date_flags[style_id]:
                    value = _serial_to_str(raw)
                else:
                    value = raw

            cells.append(value)
        rows.append(cells)

    width = max((len(r) for r in rows), default=0)
    for r in rows:
        r.extend([""] * (width - len(r)))
    return rows
