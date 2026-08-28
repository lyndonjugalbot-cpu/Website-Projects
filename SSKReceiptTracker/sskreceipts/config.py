"""Runtime configuration.

Everything is overridable by environment variable so the same code runs from a
laptop double-click and from a systemd unit.
"""

from __future__ import annotations

import os
from pathlib import Path

# Add a row here to support another store/currency; nothing else changes.
CURRENCIES = {
    "PHP": {"code": "PHP", "symbol": "₱", "locale": "en-PH"},
    "USD": {"code": "USD", "symbol": "$", "locale": "en-US"},
    "NZD": {"code": "NZD", "symbol": "$", "locale": "en-NZ"},
    "AUD": {"code": "AUD", "symbol": "$", "locale": "en-AU"},
    "EUR": {"code": "EUR", "symbol": "€", "locale": "en-IE"},
    "GBP": {"code": "GBP", "symbol": "£", "locale": "en-GB"},
    "KRW": {"code": "KRW", "symbol": "₩", "locale": "ko-KR"},
}
DEFAULT_CURRENCY = "PHP"


def build(instance_path: str) -> dict:
    code = os.environ.get("SSK_CURRENCY", DEFAULT_CURRENCY).upper()
    database = os.environ.get("SSK_DATABASE") or str(Path(instance_path) / "receipts.sqlite3")
    return {
        "DATABASE": database,
        "CURRENCY": CURRENCIES.get(code, CURRENCIES[DEFAULT_CURRENCY]),
        "STORE_NAME": os.environ.get("SSK_STORE_NAME", "Seoul Stop Kmart"),
        # Only used for flash-free session cookies; no auth in this app.
        "SECRET_KEY": os.environ.get("SSK_SECRET_KEY", "ssk-receipt-tracker-dev"),
        "JSON_SORT_KEYS": False,
    }
