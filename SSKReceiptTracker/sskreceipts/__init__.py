"""SSK Receipt Tracker - a small Flask app for logging store receipts.

Create the app with :func:`create_app`; ``run.py`` and ``flask --app`` both use it.
"""

from __future__ import annotations

import os

from flask import Flask, render_template

from . import api, config, db

__version__ = "1.0.0"


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(config.build(app.instance_path))
    if test_config:
        app.config.update(test_config)

    if not app.config.get("DATABASE_URL"):
        # Only the SQLite backend needs somewhere on disk to live.
        os.makedirs(app.instance_path, exist_ok=True)

    db.register(app)
    app.register_blueprint(api.bp)

    @app.get("/")
    def index():
        return render_template(
            "index.html",
            store_name=app.config["STORE_NAME"],
            currency=app.config["CURRENCY"],
            version=__version__,
        )

    @app.get("/healthz")
    def healthz():
        """Liveness plus a real round trip to the database."""
        try:
            db.date_bounds()
        except Exception as exc:  # surfaced as a status, never as a stack trace
            return {"ok": False, "version": __version__, "database": str(exc)}, 503
        return {
            "ok": True,
            "version": __version__,
            "database": "postgres" if app.config.get("DATABASE_URL") else "sqlite",
        }

    return app
