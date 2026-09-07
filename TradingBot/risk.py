"""
Position sizing and stop placement -- the "how big is this trade and
where's the stop" decisions, kept separate from both signal logic
(strategy.py) and order plumbing (broker.py / exchange.py).

Everything here is pure arithmetic on plain floats: no candles, no
DataFrames, no config object, no I/O. main.py and backtest.py compute the
ATR (via strategy.py) plus the current equity, call these three
functions, and hand the numbers to the broker. web/app.py carries a
line-for-line copy of this logic for its dependency-free serverless
rewrite -- if you change a formula here, change it there too.
"""

from __future__ import annotations


def initial_stop_price(
    entry_price: float,
    atr: float | None,
    atr_stop_mult: float,
    max_stop_pct: float,
) -> float:
    """
    Where to put the stop when opening a long.

    With an ATR available and atr_stop_mult > 0, the stop sits
    atr_stop_mult * ATR below entry -- a distance that scales with how
    much this market is actually moving right now. max_stop_pct is then a
    hard cap on risk: the stop is never placed further than max_stop_pct
    below entry (0.05 = 5%), so a volatility spike can't hand you an
    arbitrarily large loss. With no ATR (warming up) or atr_stop_mult == 0
    the stop is simply max_stop_pct below entry -- the old fixed stop.
    """
    hard_floor = entry_price * (1 - max_stop_pct)
    if atr and atr > 0 and atr_stop_mult > 0:
        return max(entry_price - atr_stop_mult * atr, hard_floor)
    return hard_floor


def trailed_stop_price(
    current_stop: float,
    highest_price_since_entry: float,
    atr: float | None,
    atr_trail_mult: float,
) -> float:
    """
    Ratchet a long's stop up to atr_trail_mult * ATR below the highest
    price seen since entry. Never lowers the stop -- a trailing stop only
    tightens -- so it's safe to call on every poll. atr_trail_mult == 0 or
    no ATR leaves the stop exactly where it was.
    """
    if not atr or atr <= 0 or atr_trail_mult <= 0:
        return current_stop
    candidate = highest_price_since_entry - atr_trail_mult * atr
    return max(current_stop, candidate)


def position_quote(
    equity: float,
    entry_price: float,
    stop_loss_price: float,
    risk_per_trade_pct: float,
    fallback_quote: float,
    available_quote: float,
    max_position_pct_equity: float = 1.0,
) -> float:
    """
    How much quote currency to spend on an entry.

    With risk_per_trade_pct > 0, size the trade so that price falling to
    stop_loss_price costs about risk_per_trade_pct of equity (0.01 = 1%):
    a wider stop buys less, a tighter stop buys more, so every trade risks
    the same slice of the account regardless of where the stop landed.
    With risk_per_trade_pct == 0 (or a non-positive stop distance, which
    would blow the formula up) fall back to a flat fallback_quote.

    The result is clamped to [0, min(available_quote,
    max_position_pct_equity * equity)] -- spot, long-only, no leverage,
    and never more than that fraction of equity in a single trade.
    """
    stop_distance = entry_price - stop_loss_price
    if risk_per_trade_pct > 0 and equity > 0 and stop_distance > 0:
        size = (equity * risk_per_trade_pct) * entry_price / stop_distance
    else:
        size = fallback_quote

    ceiling = available_quote
    if equity > 0:
        ceiling = min(ceiling, max_position_pct_equity * equity)
    return max(0.0, min(size, ceiling))
