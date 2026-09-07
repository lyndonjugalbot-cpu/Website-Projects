"""
Pure signal logic: candles in, "buy" / "sell" / "hold" out.

No network calls, no exchange objects, no order placement, no state. This
is deliberate -- it's what makes this module unit-testable with plain
DataFrames and reusable unchanged by both main.py (live/paper loop) and
backtest.py (historical replay). If you want to try a different strategy
later (RSI, MACD, whatever), it should live in a module shaped exactly
like this one and be a drop-in swap.
"""

from __future__ import annotations

import pandas as pd

REQUIRED_COLUMNS = {"timestamp", "open", "high", "low", "close", "volume"}


def drop_unclosed_candle(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drop the last row of a candle DataFrame.

    Exchanges report the current, still-forming candle alongside closed
    ones. Its close price keeps changing until the candle period ends, so
    computing indicators on it produces crossovers that appear and then
    vanish on the next poll -- a "fake signal" that has burned a lot of
    naive bots. Always call this before generate_signal().
    """
    return df.iloc[:-1].reset_index(drop=True)


def compute_emas(df: pd.DataFrame, fast_period: int, slow_period: int) -> pd.DataFrame:
    """Return a copy of df with ema_fast and ema_slow columns added."""
    out = df.copy()
    out["ema_fast"] = out["close"].ewm(span=fast_period, adjust=False).mean()
    out["ema_slow"] = out["close"].ewm(span=slow_period, adjust=False).mean()
    return out


def _in_uptrend(df: pd.DataFrame, trend_period: int) -> bool:
    """
    True if the last close sits above the trend EMA.

    Returns False when there isn't enough history to compute a meaningful
    trend EMA yet -- callers treat "can't tell" as "don't enter", which is
    the conservative choice for a filter whose whole job is to keep us out
    of bad entries.
    """
    if len(df) < trend_period:
        return False
    trend_ema = df["close"].ewm(span=trend_period, adjust=False).mean().iloc[-1]
    return float(df["close"].iloc[-1]) > float(trend_ema)


def latest_trend_ema(df: pd.DataFrame, trend_period: int) -> float | None:
    """Trend EMA for the most recent closed candle, or None if history is too short. For logging only."""
    if not trend_period or len(df) < trend_period:
        return None
    return float(df["close"].ewm(span=trend_period, adjust=False).mean().iloc[-1])


def generate_signal(
    df: pd.DataFrame,
    fast_period: int,
    slow_period: int,
    trend_period: int | None = None,
) -> str:
    """
    Decide "buy", "sell", or "hold" from the most recent EMA crossover,
    optionally gated by a longer-term trend filter.

    df must contain only CLOSED candles (run it through
    drop_unclosed_candle first) sorted oldest-to-newest. "buy" means fast
    EMA crossed above slow EMA on the last closed candle; "sell" means it
    crossed below. No cross on the last candle -> "hold", regardless of
    where the EMAs currently sit relative to each other.

    If trend_period is set (and non-zero), a "buy" cross is only returned
    when the last close is above the trend EMA -- a coarse "are we in an
    uptrend at all?" regime gate. This is the single biggest thing that
    stops a bare crossover from bleeding money: without it the strategy
    buys every counter-trend bounce during a downtrend, takes the fee hit,
    and gets stopped or sold back out a few candles later. "sell" crosses
    are NEVER filtered -- an exit signal must always be free to close a
    position. trend_period=None or 0 (the default) disables the filter and
    reproduces the plain-crossover behaviour exactly. When the filter is
    on but df is shorter than trend_period, "buy" is suppressed: we can't
    confirm the regime, so we don't enter.

    This function does not know whether a position is currently open --
    that's the caller's job (main.py / backtest.py), since strategy.py
    has no state.
    """
    # Need at least slow_period candles for the slow EMA to mean anything,
    # plus one more so there's a "previous" row to compare against for a
    # crossover.
    if len(df) < slow_period + 1:
        return "hold"

    with_emas = compute_emas(df, fast_period, slow_period)
    prev_fast, prev_slow = with_emas["ema_fast"].iloc[-2], with_emas["ema_slow"].iloc[-2]
    curr_fast, curr_slow = with_emas["ema_fast"].iloc[-1], with_emas["ema_slow"].iloc[-1]

    crossed_up = prev_fast <= prev_slow and curr_fast > curr_slow
    crossed_down = prev_fast >= prev_slow and curr_fast < curr_slow

    if crossed_up:
        if trend_period and not _in_uptrend(df, trend_period):
            return "hold"
        return "buy"
    if crossed_down:
        return "sell"
    return "hold"


def latest_ema_values(df: pd.DataFrame, fast_period: int, slow_period: int) -> tuple[float, float]:
    """
    Return (ema_fast, ema_slow) for the most recent closed candle.

    Separate from generate_signal() so callers that just want the current
    numbers for logging don't need to re-derive them from the signal.
    """
    with_emas = compute_emas(df, fast_period, slow_period)
    return float(with_emas["ema_fast"].iloc[-1]), float(with_emas["ema_slow"].iloc[-1])


def _true_ranges(df: pd.DataFrame) -> list[float]:
    """
    True range per candle: max(high-low, |high-prev_close|, |low-prev_close|).

    The first element is just high-low (no previous close exists yet) and
    is intentionally excluded from the ATR seed below.
    """
    high = df["high"].astype(float).tolist()
    low = df["low"].astype(float).tolist()
    close = df["close"].astype(float).tolist()
    trs = [high[0] - low[0]]
    for i in range(1, len(df)):
        trs.append(
            max(high[i] - low[i], abs(high[i] - close[i - 1]), abs(low[i] - close[i - 1]))
        )
    return trs


def compute_atr(df: pd.DataFrame, period: int) -> list[float | None]:
    """
    Wilder's Average True Range, one value per row (None until it's
    defined, i.e. for the first `period` rows).

    Seed = simple mean of the first `period` true ranges that had a
    previous close to measure against; thereafter the Wilder recursion
    ATR_t = (ATR_{t-1} * (period - 1) + TR_t) / period. Kept as an
    explicit loop (not df.ewm) so web/app.py's dependency-free copy can
    reproduce it byte-for-byte.
    """
    n = len(df)
    if period <= 0 or n < period + 1:
        return [None] * n

    trs = _true_ranges(df)
    out: list[float | None] = [None] * n
    atr = sum(trs[1 : period + 1]) / period
    out[period] = atr
    for i in range(period + 1, n):
        atr = (atr * (period - 1) + trs[i]) / period
        out[i] = atr
    return out


def latest_atr(df: pd.DataFrame, period: int) -> float | None:
    """ATR for the most recent closed candle, or None if history is too short. For stops/sizing."""
    values = compute_atr(df, period)
    return values[-1] if values and values[-1] is not None else None
