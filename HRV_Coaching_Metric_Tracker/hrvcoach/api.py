"""The JSON API the single-page front end talks to.

Two rules run through every handler here:

* **Role gates the verb, scoping gates the rows.** ``@require_role(ADMIN)``
  decides who may write; :func:`auth.scope_uid` decides whose rows a reader
  sees. Both are applied even where one would appear to be enough, because the
  failure they prevent - an employee reading a colleague's coaching log - is
  the one this app cannot get wrong.
* **Validation errors carry a field.** The front end paints the message next to
  the offending input instead of showing a banner.
"""

from __future__ import annotations

import datetime as dt

from flask import Blueprint, Response, current_app, jsonify, request

from . import auth, db, metrics, recordings, validation
from .auth import ADMIN, EMPLOYEE, require_login, require_role

bp = Blueprint("api", __name__, url_prefix="/api")

DEFAULT_WEEKS = 12
MAX_WEEKS = 52


def _invalid(exc: validation.Invalid):
    return jsonify(error=exc.message, field=exc.field), 400


@bp.errorhandler(413)
def _too_large(_exc):
    cap = current_app.config["MAX_RECORDING_BYTES"] // (1024 * 1024)
    return jsonify(error=f"That upload is over the {cap} MB limit.", field="recording"), 413


# --- session & reference data ----------------------------------------------

@bp.get("/session")
@require_login
def session_info():
    user = auth.current_user()
    return jsonify(
        user=auth.public_user(user),
        metrics=metrics.catalogue(),
        categories=metrics.CATEGORIES,
        statuses=metrics.STATUSES,
        org_name=current_app.config["ORG_NAME"],
        max_recording_mb=current_app.config["MAX_RECORDING_BYTES"] // (1024 * 1024),
        audio_accept=sorted("." + ext for ext in recordings.ALLOWED_EXTENSIONS),
    )


@bp.get("/employees")
@require_login
def list_employees():
    """Admins get the roster; an employee gets a one-entry list of themselves."""
    user = auth.current_user()
    if user["role"] != ADMIN:
        return jsonify(employees=[auth.public_user(user)])
    include_inactive = request.args.get("include_inactive", "1") == "1"
    people = db.list_users(include_inactive=include_inactive)
    return jsonify(employees=[auth.public_user(person) for person in people])


@bp.post("/employees")
@require_role(ADMIN)
def create_employee():
    payload = request.get_json(silent=True) or {}
    try:
        employee_id = validation.employee_id(payload.get("employee_id"))
        full_name = validation.text(payload.get("full_name"), "full_name", max_length=120)
        role = validation.choice(payload.get("role", EMPLOYEE), "role", auth.ROLES)
        team = validation.text(payload.get("team"), "team", required=False, max_length=60)
        password = validation.password(payload.get("password"))
    except validation.Invalid as exc:
        return _invalid(exc)

    if db.user_by_employee_id(employee_id):
        return jsonify(error="That employee ID is already taken.", field="employee_id"), 409

    uid = db.create_user(
        employee_id=employee_id,
        full_name=full_name,
        role=role,
        team=team,
        password_hash=auth.hash_password(password),
    )
    return jsonify(employee=auth.public_user(db.user_by_id(uid))), 201


@bp.patch("/employees/<int:uid>")
@require_role(ADMIN)
def update_employee(uid: int):
    person = db.user_by_id(uid)
    if not person:
        return jsonify(error="No such employee."), 404
    payload = request.get_json(silent=True) or {}
    fields: dict = {}

    try:
        if "full_name" in payload:
            fields["full_name"] = validation.text(payload["full_name"], "full_name", max_length=120)
        if "team" in payload:
            fields["team"] = validation.text(payload["team"], "team", required=False, max_length=60)
        if "role" in payload:
            fields["role"] = validation.choice(payload["role"], "role", auth.ROLES)
        if "active" in payload:
            fields["active"] = 1 if payload["active"] else 0
        if payload.get("password"):
            fields["password_hash"] = auth.hash_password(
                validation.password(payload["password"])
            )
    except validation.Invalid as exc:
        return _invalid(exc)

    # Refuse the edit that would leave nobody able to administer the tool.
    demotes = fields.get("role") == EMPLOYEE or fields.get("active") == 0
    if person["role"] == ADMIN and demotes and db.count_active_admins(excluding=uid) == 0:
        return jsonify(
            error="This is the last active admin - promote someone else first.", field="role"
        ), 409

    db.update_user(uid, fields)
    return jsonify(employee=auth.public_user(db.user_by_id(uid)))


# --- coaching logs ---------------------------------------------------------

def _log_fields(payload, *, partial: bool):
    """Validate a coaching-log form. Shared by create and edit."""
    fields: dict = {}

    def present(name):
        return not partial or name in payload

    if present("session_date"):
        session_date = validation.date(payload.get("session_date"), "session_date")
        fields["session_date"] = session_date
        fields["week_start"] = metrics.week_start_str(session_date)
    if present("category"):
        fields["category"] = validation.choice(payload.get("category"), "category", metrics.CATEGORIES)
    if present("metric_key"):
        fields["metric_key"] = validation.metric_key(
            payload.get("metric_key"), required=False
        )
    if present("opportunity"):
        fields["opportunity"] = validation.text(payload.get("opportunity"), "opportunity")
    if present("root_cause"):
        fields["root_cause"] = validation.text(payload.get("root_cause"), "root_cause", required=False)
    if present("action_plan"):
        fields["action_plan"] = validation.text(payload.get("action_plan"), "action_plan")
    if present("support"):
        fields["support"] = validation.text(payload.get("support"), "support", required=False)
    if present("follow_up_date"):
        fields["follow_up_date"] = validation.date(
            payload.get("follow_up_date"), "follow_up_date", required=False
        )
    if present("status"):
        fields["status"] = validation.choice(
            payload.get("status") or "open", "status", metrics.STATUSES
        )
    return fields


@bp.get("/logs")
@require_login
def list_logs():
    uid = auth.scope_uid(request.args.get("employee_uid"))
    try:
        limit = validation.positive_int(request.args.get("limit"), "limit", default=200, low=1, high=500)
        status = validation.choice(
            request.args.get("status"), "status", metrics.STATUSES, required=False
        )
        metric_key = validation.metric_key(request.args.get("metric_key"), required=False)
    except validation.Invalid as exc:
        return _invalid(exc)

    logs = db.list_logs(
        employee_uid=uid,
        status=status or None,
        metric_key=metric_key or None,
        search=(request.args.get("q") or "").strip() or None,
        limit=limit,
    )
    return jsonify(logs=logs, counts=db.log_counts_by_status(employee_uid=uid))


@bp.get("/logs/<int:log_id>")
@require_login
def read_log(log_id: int):
    log = db.get_log(log_id, employee_uid=auth.scope_uid(request.args.get("employee_uid")))
    if not log:
        return jsonify(error="No such coaching log."), 404
    return jsonify(log=log)


@bp.post("/logs")
@require_role(ADMIN)
def create_log():
    """Accepts JSON, or multipart when a recording rides along with the form."""
    payload = request.form if request.files or request.form else (request.get_json(silent=True) or {})
    try:
        fields = _log_fields(payload, partial=False)
        employee_uid = validation.positive_int(
            payload.get("employee_uid"), "employee_uid", default=0, low=0, high=2**31
        )
    except validation.Invalid as exc:
        return _invalid(exc)

    employee = db.user_by_id(employee_uid) if employee_uid else None
    if not employee:
        return jsonify(error="Pick the employee this log is for.", field="employee_uid"), 400

    fields["employee_uid"] = employee["id"]
    fields["coach_uid"] = auth.current_user()["id"]
    log_id = db.create_log(fields)

    upload = request.files.get("recording")
    if upload and upload.filename:
        try:
            accepted = recordings.accept(upload, current_app.config["MAX_RECORDING_BYTES"])
        except recordings.RejectedUpload as exc:
            # The log itself is sound - keep it and report the attachment
            # separately, so a bad file does not discard a filled-in form.
            return (
                jsonify(
                    log=db.get_log(log_id),
                    warning=str(exc),
                    field="recording",
                ),
                201,
            )
        db.add_recording(
            log_id=log_id,
            filename=accepted.filename,
            content_type=accepted.content_type,
            data=accepted.data,
            call_ref=validation.text(
                payload.get("call_ref"), "call_ref", required=False, max_length=80
            ),
        )

    return jsonify(log=db.get_log(log_id)), 201


@bp.patch("/logs/<int:log_id>")
@require_login
def edit_log(log_id: int):
    owner = db.log_owner(log_id)
    if owner is None:
        return jsonify(error="No such coaching log."), 404
    user = auth.current_user()
    payload = request.get_json(silent=True) or {}

    if user["role"] != ADMIN:
        # The one write an employee has: acknowledging their own log. Every
        # other key in the payload is ignored rather than half-applied.
        if owner != user["id"]:
            return jsonify(error="That coaching log is not yours."), 403
        if not payload.get("acknowledge"):
            return jsonify(error="You can acknowledge this log, but not edit it."), 403
        db.update_log(log_id, {"acknowledged_at": db.now()})
        return jsonify(log=db.get_log(log_id, employee_uid=user["id"]))

    try:
        fields = _log_fields(payload, partial=True)
    except validation.Invalid as exc:
        return _invalid(exc)
    if "employee_uid" in payload:
        employee = db.user_by_id(int(payload["employee_uid"] or 0))
        if not employee:
            return jsonify(error="Pick the employee this log is for.", field="employee_uid"), 400
        fields["employee_uid"] = employee["id"]
    if not fields:
        return jsonify(error="Nothing to update."), 400
    db.update_log(log_id, fields)
    return jsonify(log=db.get_log(log_id))


@bp.delete("/logs/<int:log_id>")
@require_role(ADMIN)
def remove_log(log_id: int):
    if not db.delete_log(log_id):
        return jsonify(error="No such coaching log."), 404
    return jsonify(ok=True)


# --- recordings ------------------------------------------------------------

@bp.post("/logs/<int:log_id>/recordings")
@require_role(ADMIN)
def upload_recording(log_id: int):
    if db.log_owner(log_id) is None:
        return jsonify(error="No such coaching log."), 404
    upload = request.files.get("recording")
    if not upload or not upload.filename:
        return jsonify(error="Choose a file to upload.", field="recording"), 400
    try:
        accepted = recordings.accept(upload, current_app.config["MAX_RECORDING_BYTES"])
        call_ref = validation.text(
            request.form.get("call_ref"), "call_ref", required=False, max_length=80
        )
    except recordings.RejectedUpload as exc:
        return jsonify(error=str(exc), field="recording"), 400
    except validation.Invalid as exc:
        return _invalid(exc)

    db.add_recording(
        log_id=log_id,
        filename=accepted.filename,
        content_type=accepted.content_type,
        data=accepted.data,
        call_ref=call_ref,
    )
    return jsonify(log=db.get_log(log_id)), 201


@bp.get("/recordings/<int:recording_id>")
@require_login
def stream_recording(recording_id: int):
    """Serve a recording to whoever is allowed to hear it.

    The response is deliberately defensive: the content type comes from our own
    table, ``nosniff`` stops a browser guessing something executable, and
    ``Content-Disposition: inline`` with a filename keeps a download sensible.
    """
    record = db.get_recording(recording_id)
    if not record:
        return jsonify(error="No such recording."), 404
    user = auth.current_user()
    if user["role"] != ADMIN and record["employee_uid"] != user["id"]:
        return jsonify(error="That recording is not yours."), 403

    data = record["data"]
    size = len(data)
    span = recordings.parse_range(request.headers.get("Range"), size)
    if span:
        start, end = span
        body, status = data[start : end + 1], 206
    else:
        start, end = 0, size - 1
        body, status = data, 200

    response = Response(body, status=status, mimetype=record["content_type"])
    response.headers["Accept-Ranges"] = "bytes"
    response.headers["Content-Length"] = str(len(body))
    if status == 206:
        response.headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    response.headers["Content-Disposition"] = (
        f'inline; filename="{recordings.safe_name(record["filename"])}"'
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "private, max-age=0, no-store"
    return response


@bp.delete("/recordings/<int:recording_id>")
@require_role(ADMIN)
def remove_recording(recording_id: int):
    if not db.delete_recording(recording_id):
        return jsonify(error="No such recording."), 404
    return jsonify(ok=True)


# --- metrics ---------------------------------------------------------------

def _series(rows, weeks, key_of, value_of):
    """Bucket rows into a ``{key: [value | None per week]}`` grid.

    ``None`` for a week with no reading, so a gap in the data stays a gap in
    the line instead of being interpolated into a value nobody recorded.
    """
    index = {week: i for i, week in enumerate(weeks)}
    grid = {key: [None] * len(weeks) for key in metrics.METRIC_KEYS}
    for row in rows:
        slot = index.get(row["week_start"])
        key = key_of(row)
        if slot is not None and key in grid:
            grid[key][slot] = round(float(value_of(row)), 4)
    return grid


def _trend(values):
    """Latest reading, the one before it, and the movement between them.

    Both points skip empty weeks - a metric recorded fortnightly should still
    show a real change, not a drop to nothing and back.
    """
    present = [(i, v) for i, v in enumerate(values) if v is not None]
    if not present:
        return {"latest": None, "previous": None, "delta": None, "weeks_recorded": 0}
    latest = present[-1][1]
    previous = present[-2][1] if len(present) > 1 else None
    delta = round(latest - previous, 4) if previous is not None else None
    return {
        "latest": latest,
        "previous": previous,
        "delta": delta,
        "weeks_recorded": len(present),
    }


@bp.get("/metrics")
@require_login
def read_metrics():
    """The chart payload: one series per metric, plus the team average.

    Metrics have different units and ranges, so they are never plotted on one
    pair of axes - the front end renders a small multiple per metric, and this
    payload is shaped for that (one grid per metric, not one merged table).
    """
    try:
        weeks_wanted = validation.positive_int(
            request.args.get("weeks"), "weeks", default=DEFAULT_WEEKS, low=4, high=MAX_WEEKS
        )
    except validation.Invalid as exc:
        return _invalid(exc)

    uid = auth.scope_uid(request.args.get("employee_uid"))
    weeks = metrics.recent_weeks(weeks_wanted)
    since = weeks[0]

    if uid is None:
        # Admin looking at "everyone": the employee line is the team mean, so
        # there is nothing to compare it against - one series, no legend.
        team = db.team_averages(since=since)
        grid = _series(team, weeks, lambda r: r["metric_key"], lambda r: r["value"])
        comparison = {key: [None] * len(weeks) for key in metrics.METRIC_KEYS}
        subject = {"id": None, "full_name": "All employees (team average)"}
    else:
        rows = db.list_metrics(employee_uid=uid, since=since)
        grid = _series(rows, weeks, lambda r: r["metric_key"], lambda r: r["value"])
        team = db.team_averages(since=since)
        comparison = _series(team, weeks, lambda r: r["metric_key"], lambda r: r["value"])
        person = db.user_by_id(uid)
        subject = {"id": uid, "full_name": person["full_name"] if person else "Unknown"}

    series = []
    for spec in metrics.catalogue():
        values = grid[spec["key"]]
        trend = _trend(values)
        series.append(
            {
                **spec,
                "values": values,
                "team": comparison[spec["key"]],
                **trend,
                "improved": (
                    metrics.improved(spec["key"], trend["delta"])
                    if trend["delta"] is not None
                    else None
                ),
            }
        )

    return jsonify(
        subject=subject,
        weeks=weeks,
        week_labels=[metrics.week_label(week) for week in weeks],
        week_ticks=[metrics.week_tick(week) for week in weeks],
        series=series,
        comparison_label="Team average",
        has_comparison=uid is not None,
    )


@bp.post("/metrics")
@require_role(ADMIN)
def write_metrics():
    """Upsert one or many weekly readings.

    Accepts ``{employee_uid, week_start, values: {metric_key: value}}`` - the
    shape the weekly entry form posts - so a full week for one employee is one
    request and one round trip.
    """
    payload = request.get_json(silent=True) or {}
    try:
        employee_uid = validation.positive_int(
            payload.get("employee_uid"), "employee_uid", default=0, low=0, high=2**31
        )
        week = metrics.week_start_str(validation.date(payload.get("week_start"), "week_start"))
        note = validation.text(payload.get("note"), "note", required=False, max_length=280)
    except validation.Invalid as exc:
        return _invalid(exc)

    employee = db.user_by_id(employee_uid) if employee_uid else None
    if not employee:
        return jsonify(error="Pick an employee.", field="employee_uid"), 400

    values = payload.get("values")
    if not isinstance(values, dict) or not values:
        return jsonify(error="Enter at least one metric.", field="values"), 400

    written = 0
    for key, raw in values.items():
        if raw in (None, ""):
            # A blank box clears that metric for the week rather than storing 0,
            # which would read as a catastrophic score on every chart.
            db.delete_metric(employee_uid=employee["id"], week_start=week, metric_key=key)
            continue
        try:
            metric = validation.metric_key(key)
            value = validation.metric_value(raw, metric, field=key)
        except validation.Invalid as exc:
            return _invalid(exc)
        db.upsert_metric(
            employee_uid=employee["id"],
            week_start=week,
            metric_key=metric,
            value=value,
            note=note,
        )
        written += 1

    return jsonify(ok=True, written=written, week_start=week)


@bp.get("/metrics/week")
@require_role(ADMIN)
def read_week():
    """What is already recorded for one employee in one week - prefills the form."""
    try:
        week = metrics.week_start_str(validation.date(request.args.get("week_start"), "week_start"))
        employee_uid = validation.positive_int(
            request.args.get("employee_uid"), "employee_uid", default=0, low=0, high=2**31
        )
    except validation.Invalid as exc:
        return _invalid(exc)
    rows = db.list_metrics(employee_uid=employee_uid, since=week)
    values = {row["metric_key"]: row["value"] for row in rows if row["week_start"] == week}
    return jsonify(week_start=week, values=values)


@bp.get("/summary")
@require_login
def summary():
    """Roster-level roll-up for the admin overview; own counts for an employee."""
    uid = auth.scope_uid(request.args.get("employee_uid"))
    counts = db.log_counts_by_status(employee_uid=uid)
    today = dt.date.today().isoformat()
    logs = db.list_logs(employee_uid=uid, limit=500)
    overdue = [
        log
        for log in logs
        if log["follow_up_date"] and log["follow_up_date"] < today and log["status"] != "closed"
    ]
    return jsonify(
        counts=counts,
        total=sum(counts.values()),
        overdue=len(overdue),
        unacknowledged=sum(1 for log in logs if not log["acknowledged_at"]),
        with_recording=sum(1 for log in logs if log["recordings"]),
    )
