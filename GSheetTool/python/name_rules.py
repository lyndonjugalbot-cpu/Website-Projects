"""Name normalisation rules for GSheetTool.

The tool's one job: join a contact's first and last name into a single
``"First Last"`` string. Every other column is left exactly as it is.
"""

from __future__ import annotations


def combine_name(first: object, last: object) -> str:
    """Join a first and last name into ``"First Last"``.

    Trims surrounding whitespace and tolerates either part being blank/None.

        combine_name("Derek", "Keen")  -> "Derek Keen"
        combine_name("Cher", "")       -> "Cher"
        combine_name("", "Prince")     -> "Prince"
    """
    parts = [
        str("" if first is None else first).strip(),
        str("" if last is None else last).strip(),
    ]
    return " ".join(p for p in parts if p)
