"""Optional inventory / supplier master loaded from a CSV."""

from __future__ import annotations

import csv
from pathlib import Path

from .model import InventoryInfo


def _f(v: str, default: float = 0.0) -> float:
    v = (v or "").strip().replace(",", "")
    try:
        return float(v)
    except ValueError:
        return default


def _i(v: str, default: int = 0) -> int:
    return int(_f(v, default))


def load_inventory(path: str | Path) -> dict[str, InventoryInfo]:
    """CSV columns (header row, case-insensitive, all optional except code):
    code, on_hand, on_order, pack_size, moq, unit_cost, supplier, lead_time_days
    """
    out: dict[str, InventoryInfo] = {}
    with open(path, newline="", encoding="utf-8") as fh:
        for raw in csv.DictReader(fh):
            row = {(k or "").strip().lower(): (v or "") for k, v in raw.items()}
            code = row.get("code", "").strip()
            if not code:
                continue
            lt = row.get("lead_time_days", "").strip()
            out[code] = InventoryInfo(
                on_hand=_f(row.get("on_hand")),
                on_order=_f(row.get("on_order")),
                pack_size=_i(row.get("pack_size"), 1) or 1,
                moq=_i(row.get("moq")),
                unit_cost=_f(row.get("unit_cost")),
                supplier=row.get("supplier", "").strip(),
                lead_time_days=int(lt) if lt.isdigit() else None,
                known=True,
            )
    return out
