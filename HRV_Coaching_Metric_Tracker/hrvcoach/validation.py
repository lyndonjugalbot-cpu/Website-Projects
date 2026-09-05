"""Input validation.

Every value that reaches the database passes through here first. The functions
raise :class:`Invalid` with a message written for the person filling the form,
not for a log file - the API turns it straight into the field error the UI
shows.
"""

from __future__ import annotations

import datetime as dt
import re

from . import metrics

EMPLOYEE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,23}$")
MAX_TEXT = 4000
MIN_PASSWORD = 8


class Invalid(ValueError):
    """A field the user can fix, with the field name attached."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field
        self.message = message


def text(value, field: str, *, required: bool = True, max_length: int = MAX_TEXT) -> str:
    cleaned = str(value or "").strip()
    if required and not cleaned:
        raise Invalid(field, f"{field.replace('_', ' ').capitalize()} is required.")
    if len(cleaned) > max_length:
        raise Invalid(field, f"Keep this under {max_length} characters.")
    return cleaned


def date(value, field: str, *, required: bool = True) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        if required:
            raise Invalid(field, "Pick a date.")
        return ""
    try:
        parsed = dt.date.fromisoformat(cleaned)
    except ValueError:
        raise Invalid(field, "Use the date picker, or type YYYY-MM-DD.") from None
    if parsed.year < 2000 or parsed > dt.date.today() + dt.timedelta(days=730):
        raise Invalid(field, "That date looks wrong - check the year.")
    return parsed.isoformat()


def choice(value, field: str, allowed, *, required: bool = True) -> str:
    cleaned = str(value or "").strip()
    if not cleaned and not required:
        return ""
    if cleaned not in allowed:
        raise Invalid(field, f"Pick one of: {', '.join(allowed)}.")
    return cleaned


def metric_key(value, field: str = "metric_key", *, required: bool = True) -> str:
    cleaned = str(value or "").strip()
    if not cleaned and not required:
        return ""
    if not metrics.is_metric(cleaned):
        raise Invalid(field, "That is not a tracked metric.")
    return cleaned


def metric_value(value, key: str, field: str = "value") -> float:
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        raise Invalid(field, "Enter a number.") from None
    if number != number or number in (float("inf"), float("-inf")):
        raise Invalid(field, "Enter a number.")
    spec = metrics.METRICS_BY_KEY[key]
    if not spec["min"] <= number <= spec["max"]:
        unit = spec["unit"]
        raise Invalid(
            field,
            f"{spec['label']} must be between {spec['min']:g}{unit} and {spec['max']:g}{unit}.",
        )
    return round(number, 4)


def employee_id(value, field: str = "employee_id") -> str:
    cleaned = str(value or "").strip()
    if not EMPLOYEE_ID_RE.match(cleaned):
        raise Invalid(
            field,
            "2-24 characters, letters and digits (dots, dashes and underscores allowed).",
        )
    return cleaned


def password(value, field: str = "password") -> str:
    cleaned = str(value or "")
    if len(cleaned) < MIN_PASSWORD:
        raise Invalid(field, f"Use at least {MIN_PASSWORD} characters.")
    if len(cleaned) > 200:
        raise Invalid(field, "That password is too long.")
    return cleaned


def positive_int(value, field: str, *, default: int, low: int, high: int) -> int:
    if value in (None, ""):
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise Invalid(field, "Expected a whole number.") from None
    return max(low, min(high, number))
