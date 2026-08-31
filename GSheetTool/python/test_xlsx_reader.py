"""Unit tests for xlsx_reader.  Run: python -m unittest -v"""

import os
import tempfile
import unittest
import zipfile

from xlsx_reader import XlsxError, read_xlsx

_CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '</Types>'
)
_ROOT_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    '</Relationships>'
)
_WORKBOOK = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    '<sheets><sheet name="Contacts" sheetId="1" r:id="rId1"/>'
    '<sheet name="Notes" sheetId="2" r:id="rId2"/></sheets></workbook>'
)
_WB_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
    '</Relationships>'
)
_SHARED = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="6" uniqueCount="6">'
    '<si><t>First Name</t></si><si><t>Last Name</t></si><si><t>Phone</t></si>'
    '<si><t>John</t></si><si><t>Jargon</t></si><si><t>02904343199</t></si></sst>'
)
_STYLES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs>'
    '</styleSheet>'
)
# row1 headers (shared), row2: shared name + inline-string phone + numeric phone
# + a date serial (2024-03-01 = 45352) carrying the date style s="1".
_SHEET1 = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>'
    '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c>'
    '<c r="C2" t="inlineStr"><is><t>0290434319</t></is></c>'
    '<c r="D2" s="1"><v>45352</v></c></row>'
    '<row r="3"><c r="B3" t="s"><v>5</v></c><c r="C3"><v>2904343199</v></c></row>'
    '</sheetData></worksheet>'
)
_SHEET2 = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    '<row r="1"><c r="A1" t="inlineStr"><is><t>note</t></is></c></row></sheetData></worksheet>'
)


def _write_fixture(path: str) -> None:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", _CONTENT_TYPES)
        z.writestr("_rels/.rels", _ROOT_RELS)
        z.writestr("xl/workbook.xml", _WORKBOOK)
        z.writestr("xl/_rels/workbook.xml.rels", _WB_RELS)
        z.writestr("xl/sharedStrings.xml", _SHARED)
        z.writestr("xl/styles.xml", _STYLES)
        z.writestr("xl/worksheets/sheet1.xml", _SHEET1)
        z.writestr("xl/worksheets/sheet2.xml", _SHEET2)


class XlsxReaderTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, "fixture.xlsx")
        _write_fixture(self.path)
        self.addCleanup(self.dir.cleanup)

    def test_reads_first_sheet_by_default(self):
        rows = read_xlsx(self.path)
        self.assertEqual(rows[0], ["First Name", "Last Name", "Phone", ""])
        self.assertEqual(rows[1], ["John", "Jargon", "0290434319", "2024-03-01"])

    def test_cell_types(self):
        rows = read_xlsx(self.path)
        self.assertEqual(rows[1][2], "0290434319")   # inline string kept verbatim
        self.assertEqual(rows[1][3], "2024-03-01")   # date serial -> ISO date
        self.assertEqual(rows[2][2], "2904343199")   # bare number, no float noise
        self.assertEqual(rows[2][0], "")             # sparse leading cell padded

    def test_pick_sheet_by_name(self):
        self.assertEqual(read_xlsx(self.path, "Notes"), [["note"]])
        self.assertEqual(read_xlsx(self.path, "notes"), [["note"]])

    def test_unknown_sheet_raises(self):
        with self.assertRaises(XlsxError):
            read_xlsx(self.path, "Missing")

    def test_not_a_zip_raises(self):
        bad = os.path.join(self.dir.name, "bad.xlsx")
        with open(bad, "wb") as handle:
            handle.write(b"this is not a zip")
        with self.assertRaises(XlsxError):
            read_xlsx(bad)


if __name__ == "__main__":
    unittest.main()
