"""Vercel serverless entrypoint.

Vercel's Python runtime looks for a module at ``api/index.py`` exposing a WSGI
callable named ``app``, and routes every request to it (see ``vercel.json``).
This is the only file that exists for the deployed host's sake; the app itself
is unchanged from the one ``run.py`` starts locally.
"""

from __future__ import annotations

import sys
from pathlib import Path

# The function runs with `api/` as the script directory, so the project root -
# where the `hrvcoach` package lives - has to go on the path explicitly.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from hrvcoach import create_app  # noqa: E402
from hrvcoach.config import ConfigError  # noqa: E402

_SETUP_PAGE = """<!doctype html>
<title>Coaching tracker - setup needed</title>
<style>
  body {{ font: 15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
         background: #f9f9f7; color: #0b0b0b; margin: 0;
         display: grid; place-items: center; min-height: 100vh; padding: 24px; }}
  main {{ max-width: 36rem; background: #fcfcfb; border: 1px solid #e2e1dc;
          border-radius: 16px; padding: 28px 30px; }}
  h1 {{ font-size: 19px; margin: 0 0 12px; }}
  p {{ margin: 0 0 12px; color: #52514e; }}
  ol {{ color: #52514e; padding-left: 20px; margin: 0 0 12px; }}
  code {{ background: #f0efec; padding: 1px 5px; border-radius: 5px; font-size: 13px; }}
</style>
<main>
  <h1>One step left before this can hold real data</h1>
  <p>{reason}</p>
  <ol>
    <li>In the Vercel dashboard, open this project &rarr; <strong>Storage</strong>
        &rarr; <strong>Create Database</strong> &rarr; <strong>Neon (Postgres)</strong>,
        and connect it - that sets <code>DATABASE_URL</code> automatically.</li>
    <li>Under <strong>Settings &rarr; Environment Variables</strong>, add
        <code>HRV_SECRET_KEY</code> with a long random value.</li>
    <li>Redeploy so the function picks up both.</li>
  </ol>
  <p>The tables create themselves on the first request afterwards.</p>
</main>
"""


def _setup_required(reason: str):
    """A WSGI app that explains the misconfiguration instead of a blank 500.

    The most likely first state of a new deployment is "shipped, database not
    connected yet". Saying so beats an opaque crash in the function logs.
    """
    body = _SETUP_PAGE.format(reason=reason).encode("utf-8")

    def application(environ, start_response):
        headers = [
            ("Content-Type", "text/html; charset=utf-8"),
            ("Content-Length", str(len(body))),
            ("Cache-Control", "no-store"),
        ]
        start_response("503 Service Unavailable", headers)
        return [body]

    return application


def _build_app():
    """Return the real app, or the setup-needed placeholder if config is absent.

    Kept as a function so ``app`` below is a plain module-level assignment -
    Vercel's Python runtime scans the AST for a top-level ``app`` and does not
    look inside a ``try`` block.
    """
    try:
        return create_app()
    except ConfigError as exc:
        return _setup_required(str(exc))


app = _build_app()
