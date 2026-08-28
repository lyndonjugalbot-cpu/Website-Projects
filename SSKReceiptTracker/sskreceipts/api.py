"""JSON API + CSV export.

The page is rendered once and every filter change is a single ``/api/dashboard``
round trip, so the date range can be swept without a reload.
"""

from __future__ import annotations

import csv
import datetime as dt
import io

from flask import Blueprint, Response, current_app, jsonify, request

from . import db, stats
from .money import MoneyError, format_major, parse_amount
from .validation import FieldError, clean_name, group_key, parse_date, parse_range

bp = Blueprint("api", __name__, url_prefix="/api")


def _error(message: str, field: str | None = None, status: int = 400):
    payload = {"ok": False, "error": message}
    if field:
        payload["field"] = field
    return jsonify(payload), status


@bp.errorhandler(FieldError)
def _handle_field_error(exc: FieldError):
    return _error(exc.message, exc.field)


@bp.errorhandler(MoneyError)
def _handle_money_error(exc: MoneyError):
    return _error(str(exc), "amount")


def _payload() -> dict:
    """Read the request body as JSON, tolerating a plain form post."""
    data = request.get_json(silent=True)
    if data is None:
        data = request.form.to_dict()
    if not isinstance(data, dict):
        raise FieldError("name", "Expected a JSON object.")
    return data


def _read_fields(data: dict) -> tuple[str, str, int, dt.date]:
    name = clean_name(data.get("name"))
    return name, group_key(name), parse_amount(data.get("amount")), parse_date(data.get("date"))


def _resolve_range() -> tuple[dt.date, dt.date]:
    """The effective filter window, defaulting to everything on record."""
    start, end = parse_range(request.args.get("start"), request.args.get("end"))
    if start is None or end is None:
        lo, hi = db.date_bounds()
        today = dt.date.today()
        if start is None:
            start = dt.date.fromisoformat(lo) if lo else today.replace(day=1)
        if end is None:
            end = dt.date.fromisoformat(hi) if hi else today
    if start > end:
        start = end
    return start, end


# --- reads -----------------------------------------------------------------

@bp.get("/dashboard")
def dashboard():
    """Receipts + every aggregate for one date range, in one response."""
    start, end = _resolve_range()
    rows = db.list_receipts(start, end)

    prev_start, prev_end = stats.previous_period(start, end)
    prev_rows = db.list_receipts(prev_start, prev_end)
    prev_total = sum(r["amount_minor"] for r in prev_rows)

    lo, hi = db.date_bounds()
    return jsonify({
        "ok": True,
        "receipts": stats.rows_to_json(rows),
        "summary": stats.summarise(rows, start, end, previous_total_minor=prev_total),
        "suggestions": db.name_suggestions(),
        "bounds": {"earliest": lo, "latest": hi, "today": dt.date.today().isoformat()},
        "currency": current_app.config["CURRENCY"],
    })


@bp.get("/export.csv")
def export_csv():
    start, end = _resolve_range()
    rows = db.list_receipts(start, end)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Date", "Receipt name", f"Amount ({current_app.config['CURRENCY']['code']})"])
    for row in rows:
        writer.writerow([row["date"], row["name"], format_major(row["amount_minor"])])
    writer.writerow([])
    writer.writerow(["Total", "", format_major(sum(r["amount_minor"] for r in rows))])

    filename = f"ssk-receipts-{start.isoformat()}-to-{end.isoformat()}.csv"
    return Response(
        # The BOM makes Excel open the file as UTF-8 instead of mangling names.
        "﻿" + buffer.getvalue(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- writes ----------------------------------------------------------------

@bp.post("/receipts")
def create_receipt():
    name, key, amount, date = _read_fields(_payload())
    receipt_id = db.insert_receipt(name, key, amount, date)
    row = db.get_receipt(receipt_id)
    return jsonify({"ok": True, "receipt": stats.rows_to_json([row])[0]}), 201


@bp.put("/receipts/<int:receipt_id>")
def edit_receipt(receipt_id: int):
    if db.get_receipt(receipt_id) is None:
        return _error("That receipt no longer exists.", status=404)
    name, key, amount, date = _read_fields(_payload())
    db.update_receipt(receipt_id, name, key, amount, date)
    return jsonify({"ok": True, "receipt": stats.rows_to_json([db.get_receipt(receipt_id)])[0]})


@bp.delete("/receipts/<int:receipt_id>")
def remove_receipt(receipt_id: int):
    row = db.get_receipt(receipt_id)
    if row is None:
        return _error("That receipt no longer exists.", status=404)
    db.delete_receipt(receipt_id)
    # Echo the deleted row back so the UI can offer an undo.
    return jsonify({"ok": True, "receipt": stats.rows_to_json([row])[0]})
