"""Phone-number and name normalisation rules for GSheetTool.

Target phone format (New Zealand): the plain local number - a single leading
``0`` followed by the national digits, with no spaces or punctuation.

Input shapes handled (from the brief):

    02904343199    -> 02904343199
    2904343199.    -> 02904343199
    +642904343199  -> 02904343199
    290434319      -> 0290434319

A leading text-forcing apostrophe (``'02904343199``), a ``+64`` / ``0064`` /
``64`` country code and any extra trunk zeros are stripped; a single ``0`` is
then prepended. The function is idempotent: feeding it its own output returns
the same string, so it is safe to re-run over an already-cleaned column.
"""

from __future__ import annotations

import re

_NON_DIGIT_RE = re.compile(r"\D+")
_COUNTRY_CODE = "64"


class PhoneParseError(ValueError):
    """Raised when a value cannot be understood as a phone number."""


def _to_national(raw: object) -> str:
    """Strip formatting plus any IDD / country / trunk prefix.

    Returns the national significant number as a bare digit string.
    """
    text = str("" if raw is None else raw).strip().lstrip("'").strip()
    if not text:
        raise PhoneParseError("empty value")

    digits = _NON_DIGIT_RE.sub("", text)
    if not digits:
        raise PhoneParseError(f"no digits in {raw!r}")

    international = text.startswith("+") or digits.startswith("00")

    if international:
        digits = digits.lstrip("0")                       # drop 00 IDD prefix
        if digits.startswith(_COUNTRY_CODE):
            digits = digits[len(_COUNTRY_CODE):]          # drop +64
        if digits.startswith("0"):
            digits = digits[1:]                           # drop trunk 0
    elif digits.startswith(_COUNTRY_CODE) and len(digits) >= 10:
        digits = digits[len(_COUNTRY_CODE):]             # bare 64... without '+'
        if digits.startswith("0"):
            digits = digits[1:]
    elif digits.startswith("0"):
        digits = digits[1:]                               # drop trunk 0

    if len(digits) < 4:
        raise PhoneParseError(f"too few digits in {raw!r} -> {digits!r}")

    return digits


def normalise_phone(raw: object) -> str:
    """Return the plain local number (``0`` + national digits) for *raw*.

    Raises :class:`PhoneParseError` for values that hold no usable number.
    """
    return "0" + _to_national(raw)


def try_normalise_phone(raw: object) -> tuple[str, str]:
    """Non-raising variant.

    Returns ``(value, status)`` where *status* is one of:

    * ``"fixed"``     - reformatted, value changed
    * ``"unchanged"`` - already in plain local form
    * ``"empty"``     - blank input, left as-is
    * ``"failed"``    - could not be parsed, original text returned untouched
    """
    original = "" if raw is None else str(raw)
    if not original.strip():
        return original, "empty"
    try:
        fixed = normalise_phone(original)
    except PhoneParseError:
        return original, "failed"
    return fixed, "fixed" if fixed != original.strip() else "unchanged"


def combine_name(first: object, last: object) -> str:
    """Join a first and last name into ``"First Last"``.

    Trims surrounding whitespace and tolerates either part being blank/None.
    """
    parts = [
        str("" if first is None else first).strip(),
        str("" if last is None else last).strip(),
    ]
    return " ".join(p for p in parts if p)
