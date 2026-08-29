"""Runtime configuration.

Everything is overridable by environment variable so the same code runs from a
laptop double-click, a systemd unit, and a serverless function.
"""

from __future__ import annotations

import os
from pathlib import Path

from .storage import URL_ENV_VARS, is_postgres_url

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


class ConfigError(RuntimeError):
    """Raised when the app is deployed somewhere its storage cannot survive."""


def database_url() -> str | None:
    """The first Postgres URL any of the usual integrations exported."""
    for name in URL_ENV_VARS:
        value = os.environ.get(name)
        if is_postgres_url(value):
            return value
    return None


def is_serverless() -> bool:
    """True on a host whose filesystem does not survive between requests."""
    return bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


def build(instance_path: str) -> dict:
    code = os.environ.get("SSK_CURRENCY", DEFAULT_CURRENCY).upper()
    url = database_url()

    if url is None and is_serverless() and not os.environ.get("SSK_ALLOW_EPHEMERAL_DB"):
        # Failing loudly here beats accepting receipts into a /tmp SQLite file
        # that the next request will not be able to find.
        raise ConfigError(
            "This app is running on a serverless host with no Postgres configured, "
            "where a SQLite file does not survive between requests - every receipt "
            "entered would be lost. Add a Postgres database and set DATABASE_URL. "
            "See README.md > Deploying to Vercel. Set SSK_ALLOW_EPHEMERAL_DB=1 to "
            "override for a throwaway demo."
        )

    return {
        "DATABASE": os.environ.get("SSK_DATABASE") or str(Path(instance_path) / "receipts.sqlite3"),
        "DATABASE_URL": url,
        "CURRENCY": CURRENCIES.get(code, CURRENCIES[DEFAULT_CURRENCY]),
        "STORE_NAME": os.environ.get("SSK_STORE_NAME", "Seoul Stop Kmart"),
        # Only used for flash-free session cookies; no auth in this app.
        "SECRET_KEY": os.environ.get("SSK_SECRET_KEY", "ssk-receipt-tracker-dev"),
        "JSON_SORT_KEYS": False,
    }
