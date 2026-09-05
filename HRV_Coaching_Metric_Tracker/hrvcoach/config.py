"""Runtime configuration.

Everything is overridable by environment variable so the same code runs from a
laptop double-click, a systemd unit, and a serverless function.
"""

from __future__ import annotations

import os
import secrets
from pathlib import Path

from .storage import URL_ENV_VARS, is_postgres_url

# 25 MB holds a ~45-minute call at 64 kbps mono, which is longer than any call
# a coaching log attaches. It is also comfortably under the 4.5 MB-per-request
# ceiling some serverless hosts impose - see README > Deploying.
MAX_RECORDING_BYTES = 25 * 1024 * 1024


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


def _secret_key() -> str:
    """The session-signing key.

    Unlike a display setting this one is load-bearing: it is what stops a
    visitor forging an admin session cookie. A random per-process fallback logs
    everyone out on restart, which is the safe way to fail - never a shipped
    default that every deployment shares.
    """
    key = os.environ.get("HRV_SECRET_KEY")
    if key:
        return key
    if is_serverless():
        raise ConfigError(
            "HRV_SECRET_KEY is not set. On a serverless host every instance needs "
            "the same session-signing key or logins stop working between requests - "
            "and a shared default key would let anyone forge an admin session. "
            "Generate one with `python -c \"import secrets; print(secrets.token_hex(32))\"` "
            "and set it as an environment variable."
        )
    return secrets.token_hex(32)


def build(instance_path: str) -> dict:
    url = database_url()

    if url is None and is_serverless() and not os.environ.get("HRV_ALLOW_EPHEMERAL_DB"):
        # Failing loudly here beats accepting coaching logs into a /tmp SQLite
        # file that the next request will not be able to find.
        raise ConfigError(
            "This app is running on a serverless host with no Postgres configured, "
            "where a SQLite file does not survive between requests - every coaching "
            "log and recording entered would be lost. Add a Postgres database and "
            "set DATABASE_URL. See README.md > Deploying. Set HRV_ALLOW_EPHEMERAL_DB=1 "
            "to override for a throwaway demo."
        )

    return {
        "DATABASE": os.environ.get("HRV_DATABASE") or str(Path(instance_path) / "coaching.sqlite3"),
        "DATABASE_URL": url,
        "ORG_NAME": os.environ.get("HRV_ORG_NAME", "HRV Support"),
        "SECRET_KEY": _secret_key(),
        "MAX_RECORDING_BYTES": int(
            os.environ.get("HRV_MAX_RECORDING_BYTES", MAX_RECORDING_BYTES)
        ),
        # Flask rejects a larger body before it reaches a view; leave headroom
        # for the form fields that travel alongside the file.
        "MAX_CONTENT_LENGTH": int(
            os.environ.get("HRV_MAX_RECORDING_BYTES", MAX_RECORDING_BYTES)
        ) + 512 * 1024,
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Lax",
        # Set on any host that terminates TLS; harmless to leave off for a
        # plain-HTTP localhost run, which is the only place it would break.
        "SESSION_COOKIE_SECURE": os.environ.get("HRV_HTTPS", "1" if is_serverless() else "0") == "1",
        "SEED_DEMO": os.environ.get("HRV_SEED_DEMO", "1") == "1",
        "JSON_SORT_KEYS": False,
    }
