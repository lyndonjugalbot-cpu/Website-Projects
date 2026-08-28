"""Field validation shared by the API and the CSV importer."""

from __future__ import annotations

import datetime as dt
import unicodedata

MAX_NAME_LEN = 120

# Receipts are historical documents. We still allow a small forward window so a
# post-dated invoice - or a user whose clock/timezone runs ahead of the server -
# is not rejected.
EARLIEST_DATE = dt.date(2000, 1, 1)
FUTURE_GRACE_DAYS = 31


class FieldError(ValueError):
    """A single invalid field. ``field`` is the form input to highlight."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field
        self.message = message


def clean_name(raw: object) -> str:
    """Normalise a receipt name: collapse whitespace, strip control characters."""
    if not isinstance(raw, str):
        raise FieldError("name", "Receipt name is required.")

    # NFC so visually identical names group together in the "by area" rollup.
    text = unicodedata.normalize("NFC", raw)
    text = "".join(ch for ch in text if ch == " " or not unicodedata.category(ch).startswith("C"))
    text = " ".join(text.split())

    if not text:
        raise FieldError("name", "Receipt name is required.")
    if len(text) > MAX_NAME_LEN:
        raise FieldError("name", f"Receipt name must be {MAX_NAME_LEN} characters or fewer.")
    return text


def group_key(name: str) -> str:
    """The key receipts are grouped by for the "spending area" rollup.

    Case- and whitespace-insensitive, so "Meralco", "meralco" and "MERALCO "
    are one area rather than three.
    """
    return " ".join(name.split()).casefold()


def parse_date(raw: object, field: str = "date", *, bounded: bool = True) -> dt.date:
    """Parse an ISO ``YYYY-MM-DD`` string into a date."""
    if isinstance(raw, dt.date) and not isinstance(raw, dt.datetime):
        value = raw
    else:
        if not isinstance(raw, str) or not raw.strip():
            raise FieldError(field, "Date is required.")
        try:
            value = dt.date.fromisoformat(raw.strip())
        except ValueError:
            raise FieldError(field, "Date must be in YYYY-MM-DD format.") from None

    if bounded:
        if value < EARLIEST_DATE:
            raise FieldError(field, f"Date must be on or after {EARLIEST_DATE.isoformat()}.")
        latest = dt.date.today() + dt.timedelta(days=FUTURE_GRACE_DAYS)
        if value > latest:
            raise FieldError(field, "Date is too far in the future - check the year.")
    return value


def parse_range(start_raw: object, end_raw: object) -> tuple[dt.date | None, dt.date | None]:
    """Parse an optional filter range. Either end may be omitted (open-ended)."""
    start = None if start_raw in (None, "") else parse_date(start_raw, "start", bounded=False)
    end = None if end_raw in (None, "") else parse_date(end_raw, "end", bounded=False)
    if start and end and start > end:
        raise FieldError("start", "The start date must be on or before the end date.")
    return start, end
