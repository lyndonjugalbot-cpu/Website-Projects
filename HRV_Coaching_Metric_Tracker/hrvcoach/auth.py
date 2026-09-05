"""Sign-in, sessions, and the two roles.

**admin** - the team leader. Writes coaching logs, uploads recordings, enters
weekly metrics, manages the roster, and sees every employee.

**employee** - sees their *own* coaching logs and their *own* metrics, plus the
team average as context, and can acknowledge a log addressed to them. Nothing
else: no other employee's data, no writes to the log itself.

Enforcement is deliberately boring and in one place. :func:`require_role` gates
the write endpoints, and :func:`scope_uid` returns the employee id a request is
allowed to read - for an employee that is always their own, whatever the query
string asked for. Callers pass that value into the SQL, so a scoping mistake
shows up as an empty result rather than as somebody else's coaching history.
"""

from __future__ import annotations

from functools import wraps

from flask import Blueprint, current_app, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from . import db, validation

bp = Blueprint("auth", __name__)

ADMIN = "admin"
EMPLOYEE = "employee"
ROLES = (ADMIN, EMPLOYEE)

# Shown wherever the UI needs to name the role in a sentence.
ROLE_LABELS = {ADMIN: "Team Leader / Admin", EMPLOYEE: "Employee"}


def hash_password(raw: str) -> str:
    return generate_password_hash(raw)


def current_user() -> dict | None:
    """The signed-in user, re-read once per request.

    Read from the database rather than trusted from the cookie so that
    deactivating someone, or changing their role, takes effect on their very
    next request instead of whenever they happen to log out.
    """
    if "user" not in g:
        uid = session.get("uid")
        user = db.user_by_id(uid) if uid else None
        if user and not user["active"]:
            session.clear()
            user = None
        g.user = user
    return g.user


def is_admin() -> bool:
    user = current_user()
    return bool(user and user["role"] == ADMIN)


def wants_json() -> bool:
    return request.path.startswith("/api/") or request.accept_mimetypes.best == "application/json"


def require_login(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_user() is None:
            if wants_json():
                return jsonify(error="Sign in to continue."), 401
            return redirect(url_for("auth.login", next=request.path))
        return view(*args, **kwargs)

    return wrapped


def require_role(*roles: str):
    """Gate a view on role. Always paired with a scoped query, never instead of one."""

    def decorator(view):
        @wraps(view)
        @require_login
        def wrapped(*args, **kwargs):
            if current_user()["role"] not in roles:
                if wants_json():
                    return jsonify(error="Your account cannot do that."), 403
                return render_template("denied.html", user=current_user()), 403
            return view(*args, **kwargs)

        return wrapped

    return decorator


def scope_uid(requested) -> int | None:
    """The employee id this request may read.

    Admins get whatever they asked for (``None`` meaning "everyone"); an
    employee always gets their own id, no matter what the query string said.
    """
    user = current_user()
    if user["role"] != ADMIN:
        return int(user["id"])
    if requested in (None, "", "all"):
        return None
    try:
        return int(requested)
    except (TypeError, ValueError):
        return None


def public_user(user: dict) -> dict:
    """A user as the API returns them - never including the password hash."""
    return {
        "id": user["id"],
        "employee_id": user["employee_id"],
        "full_name": user["full_name"],
        "role": user["role"],
        "role_label": ROLE_LABELS[user["role"]],
        "team": user["team"],
        "active": bool(user["active"]),
    }


@bp.get("/login")
def login():
    if current_user() is not None:
        return redirect(url_for("dashboard"))
    return render_template(
        "login.html",
        org_name=current_app.config["ORG_NAME"],
        demo=current_app.config.get("SEED_DEMO"),
    )


@bp.post("/login")
def login_submit():
    employee_id = str(request.form.get("employee_id", "")).strip()
    password = str(request.form.get("password", ""))
    user = db.user_by_employee_id(employee_id) if employee_id else None

    # One message for "no such id" and "wrong password" - telling them apart
    # turns the sign-in form into an employee-id oracle.
    if not user or not user["active"] or not check_password_hash(user["password_hash"], password):
        return (
            render_template(
                "login.html",
                org_name=current_app.config["ORG_NAME"],
                demo=current_app.config.get("SEED_DEMO"),
                error="That employee ID and password do not match an active account.",
                employee_id=employee_id,
            ),
            401,
        )

    session.clear()
    session["uid"] = user["id"]
    session.permanent = False
    target = request.form.get("next") or request.args.get("next") or ""
    # Only ever redirect within this app - an absolute URL here would make the
    # login form an open redirect.
    if not target.startswith("/") or target.startswith("//"):
        target = url_for("dashboard")
    return redirect(target)


@bp.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))


@bp.post("/api/password")
@require_login
def change_password():
    """Anyone may change their own password; nobody else's."""
    payload = request.get_json(silent=True) or {}
    user = db.user_by_employee_id(current_user()["employee_id"])
    if not check_password_hash(user["password_hash"], str(payload.get("current", ""))):
        return jsonify(error="Current password is not right.", field="current"), 400
    try:
        fresh = validation.password(payload.get("new"), "new")
    except validation.Invalid as exc:
        return jsonify(error=exc.message, field=exc.field), 400
    db.update_user(user["id"], {"password_hash": hash_password(fresh)})
    return jsonify(ok=True)
