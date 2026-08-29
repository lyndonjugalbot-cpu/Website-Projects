"""Money handling.

Amounts are stored as **integer centavos** and only ever become floats at the
JSON boundary. Binary floats cannot represent 0.10, so a month of receipts
summed as floats drifts; summed as integers it is exact.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

# Highest single receipt we accept: 100 million major units. Anything larger is
# a typo (a missing decimal point) far more often than a real receipt.
MAX_MINOR_UNITS = 100_000_000 * 100

_STRIP = re.compile(r"[\s,_ ₱$€£¥]")


class MoneyError(ValueError):
    """Raised when a user-supplied amount cannot be read as money."""


def parse_amount(raw: object) -> int:
    """Parse a user-supplied amount into integer minor units (centavos).

    Accepts ``1234.5``, ``"1,234.50"``, ``"P 1234.50"`` and friends. Rejects
    zero, negatives and anything with more precision than the currency has.
    """
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        raise MoneyError("Amount is required.")

    if isinstance(raw, bool):  # bool is an int subclass; never a valid amount.
        raise MoneyError("Amount must be a number.")

    if isinstance(raw, (int, float, Decimal)):
        text = str(raw)
    elif isinstance(raw, str):
        text = _STRIP.sub("", raw)
    else:
        raise MoneyError("Amount must be a number.")

    try:
        value = Decimal(text)
    except (InvalidOperation, ValueError):
        raise MoneyError("Amount must be a number, e.g. 1250.75.") from None

    if not value.is_finite():
        raise MoneyError("Amount must be a number, e.g. 1250.75.")
    if value <= 0:
        raise MoneyError("Amount must be greater than zero.")
    if value.as_tuple().exponent < -2:
        raise MoneyError("Amount cannot have more than 2 decimal places.")

    minor = int((value * 100).to_integral_value(rounding=ROUND_HALF_UP))
    if minor > MAX_MINOR_UNITS:
        raise MoneyError("Amount is unrealistically large - check the decimal point.")
    return minor


def to_major(minor_units: int) -> float:
    """Minor units -> a JSON-friendly float. Display only; never summed."""
    return round(minor_units / 100, 2)


def format_major(minor_units: int) -> str:
    """Minor units -> a plain ``1234.50`` string, for CSV export."""
    return f"{Decimal(minor_units) / 100:.2f}"
