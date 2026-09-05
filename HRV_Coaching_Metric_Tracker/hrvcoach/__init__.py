"""HRV Coaching Log & Metric Tracker.

A team-leader tool: record a coaching conversation against an employee, attach
the call it came from, enter that employee's weekly numbers, and watch whether
the numbers move afterwards.

Create the app with :func:`create_app`; ``run.py`` and ``flask --app`` both use it.
"""

from __future__ import annotations

import os

import click
from flask import Flask, redirect, render_template, url_for

from . import api, auth, config, db, metrics

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
    app.register_blueprint(auth.bp)
    app.register_blueprint(api.bp)
    _register_cli(app)

    @app.get("/")
    @auth.require_login
    def dashboard():
        user = auth.current_user()
        return render_template(
            "app.html",
            user=auth.public_user(user),
            is_admin=user["role"] == auth.ADMIN,
            org_name=app.config["ORG_NAME"],
            version=__version__,
        )

    @app.get("/healthz")
    def healthz():
        """Liveness plus a real round trip to the database."""
        try:
            db.count_users()
        except Exception as exc:  # surfaced as a status, never as a stack trace
            return {"ok": False, "version": __version__, "database": str(exc)}, 503
        return {
            "ok": True,
            "version": __version__,
            "database": "postgres" if app.config.get("DATABASE_URL") else "sqlite",
        }

    @app.errorhandler(404)
    def _not_found(_exc):
        return redirect(url_for("dashboard"))

    return app


def _register_cli(app: Flask) -> None:
    @app.cli.command("create-admin")
    @click.option("--employee-id", prompt=True)
    @click.option("--name", prompt="Full name")
    @click.option("--team", default="", help="Optional team name.")
    @click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True)
    def create_admin(employee_id: str, name: str, team: str, password: str) -> None:
        """Create a team-leader account - how the first real admin is made."""
        from . import validation

        try:
            employee_id = validation.employee_id(employee_id)
            name = validation.text(name, "full_name", max_length=120)
            password = validation.password(password)
        except validation.Invalid as exc:
            raise click.ClickException(exc.message) from None
        if db.user_by_employee_id(employee_id):
            raise click.ClickException(f"{employee_id} already exists.")
        db.create_user(
            employee_id=employee_id,
            full_name=name,
            role=auth.ADMIN,
            team=team,
            password_hash=auth.hash_password(password),
        )
        click.echo(f"Admin {employee_id} created.")

    @app.cli.command("list-metrics")
    def list_metric_keys() -> None:
        """Print the tracked metrics - the keys the API accepts."""
        for spec in metrics.METRICS:
            arrow = "higher is better" if spec["direction"] == "up" else "lower is better"
            click.echo(f"{spec['key']:<12} {spec['label']:<18} {spec['unit']:<4} {arrow}")
