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


def generate_signal(df: pd.DataFrame, fast_period: int, slow_period: int) -> str:
    """
    Decide "buy", "sell", or "hold" from the most recent EMA crossover.

    df must contain only CLOSED candles (run it through
    drop_unclosed_candle first) sorted oldest-to-newest. "buy" means fast
    EMA crossed above slow EMA on the last closed candle; "sell" means it
    crossed below. No cross on the last candle -> "hold", regardless of
    where the EMAs currently sit relative to each other.

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
