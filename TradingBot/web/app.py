"""
Stateless Flask API backing the TradingBot paper-trading test page.

Why stateless: this runs as a Vercel serverless function. Serverless
functions have no persistent disk (bot_state.json's home in the real bot)
and, on Vercel's free Hobby plan, cron jobs only fire once a day -- nowhere
near enough for a poll loop. So instead of a long-running loop like
main.py's, the BROWSER drives polling: the page calls POST /api/poll every
few seconds while it's open, sending back exactly the state it got from
the previous response. This function does one thing: given a state, fetch
fresh market data and advance the state by one step. No database, no
Binance API keys -- api/klines and api/ticker/price are public,
unauthenticated endpoints, and paper trading never places real orders.

The trading logic (EMA crossover, optional long-EMA trend filter on buys,
drop-the-in-progress-candle, act-once-per-closed-candle, stop-loss checked
on every call, fee/slippage-adjusted paper fills, daily loss limit)
mirrors strategy.py / broker.py / main.py
in the root bot as closely as a dependency-free, stateless rewrite
allows -- see each function's docstring for which one it mirrors. Keep
them in sync if you change the strategy.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone

from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="public", static_url_path="")

# Binance's public, unauthenticated market-data mirror -- no API key needed,
# and no rate-limit contention with any trading traffic. See
# https://data-api.binance.vision (docs: binance-spot-api-docs, "Market Data Only").
MARKET_DATA_BASE = "https://data-api.binance.vision/api/v3"

DEFAULT_STATE = {
    "quote_balance": None,  # seeded from starting_balance on the first poll of a session
    "base_balance": 0.0,
    "position": None,
    "trade_history": [],
    "last_processed_candle_ts": None,
    "daily_loss_date": None,
    "daily_realized_loss": 0.0,
    "trading_halted": False,
    "halt_reason": None,
    "first_price_seen": None,
}


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# ---------------------------------------------------------------------------
# Market data (replaces exchange.py's fetch_ohlcv / fetch_current_price --
# same public data, fetched directly instead of through ccxt, since a
# serverless function benefits from staying dependency-light).
# ---------------------------------------------------------------------------


def _http_get_json(path: str, params: dict, timeout: float = 8.0):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(
        f"{MARKET_DATA_BASE}{path}?{query}",
        headers={"User-Agent": "TradingBot-TestPage/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_klines(binance_symbol: str, interval: str, limit: int = 500) -> list[list]:
    return _http_get_json("/klines", {"symbol": binance_symbol, "interval": interval, "limit": limit})


def fetch_price(binance_symbol: str) -> float:
    data = _http_get_json("/ticker/price", {"symbol": binance_symbol})
    return float(data["price"])


# ---------------------------------------------------------------------------
# Strategy (mirrors strategy.py's compute_emas / generate_signal, without
# pandas -- same math: pandas .ewm(span=period, adjust=False).mean() is
# exactly the recurrence below, seeded on the first close in the window).
# ---------------------------------------------------------------------------


def compute_ema_series(closes: list[float], period: int) -> list[float]:
    alpha = 2 / (period + 1)
    emas = [closes[0]]
    for price in closes[1:]:
        emas.append(alpha * price + (1 - alpha) * emas[-1])
    return emas


def trend_ema_value(closes: list[float], trend_period: int | None):
    """Latest trend EMA, or None if the filter is off / there isn't enough history. Mirrors strategy.latest_trend_ema()."""
    if not trend_period or len(closes) < trend_period:
        return None
    return compute_ema_series(closes, trend_period)[-1]


def compute_atr_series(highs: list[float], lows: list[float], closes: list[float], period: int):
    """
    Wilder's ATR, one value per candle (None until defined). Line-for-line
    copy of strategy.compute_atr() -- keep them identical.
    """
    n = len(closes)
    if period <= 0 or n < period + 1:
        return [None] * n

    trs = [highs[0] - lows[0]]
    for i in range(1, n):
        trs.append(max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1])))

    out = [None] * n
    atr = sum(trs[1 : period + 1]) / period
    out[period] = atr
    for i in range(period + 1, n):
        atr = (atr * (period - 1) + trs[i]) / period
        out[i] = atr
    return out


# ---------------------------------------------------------------------------
# Sizing / stop placement (line-for-line copy of risk.py).
# ---------------------------------------------------------------------------


def initial_stop_price(entry_price, atr, atr_stop_mult, max_stop_pct):
    hard_floor = entry_price * (1 - max_stop_pct)
    if atr and atr > 0 and atr_stop_mult > 0:
        return max(entry_price - atr_stop_mult * atr, hard_floor)
    return hard_floor


def trailed_stop_price(current_stop, highest_price_since_entry, atr, atr_trail_mult):
    if not atr or atr <= 0 or atr_trail_mult <= 0:
        return current_stop
    candidate = highest_price_since_entry - atr_trail_mult * atr
    return max(current_stop, candidate)


def position_quote(equity, entry_price, stop_loss_price, risk_per_trade_pct,
                   fallback_quote, available_quote, max_position_pct_equity=1.0):
    stop_distance = entry_price - stop_loss_price
    if risk_per_trade_pct > 0 and equity > 0 and stop_distance > 0:
        size = (equity * risk_per_trade_pct) * entry_price / stop_distance
    else:
        size = fallback_quote
    ceiling = available_quote
    if equity > 0:
        ceiling = min(ceiling, max_position_pct_equity * equity)
    return max(0.0, min(size, ceiling))


def crossover_signal(closes: list[float], fast_period: int, slow_period: int):
    """Raw EMA-crossover signal with no trend filter -- (signal, ema_fast, ema_slow)."""
    if len(closes) < slow_period + 1:
        return "hold", None, None

    fast = compute_ema_series(closes, fast_period)
    slow = compute_ema_series(closes, slow_period)
    prev_fast, prev_slow = fast[-2], slow[-2]
    curr_fast, curr_slow = fast[-1], slow[-1]

    if prev_fast <= prev_slow and curr_fast > curr_slow:
        signal = "buy"
    elif prev_fast >= prev_slow and curr_fast < curr_slow:
        signal = "sell"
    else:
        signal = "hold"
    return signal, curr_fast, curr_slow


def generate_signal(closes: list[float], fast_period: int, slow_period: int, trend_period: int | None = None):
    """
    Returns (signal, ema_fast, ema_slow, ema_trend). Mirrors strategy.generate_signal().

    When trend_period is set, a "buy" cross is only returned if the last
    close is above the trend EMA (regime gate). "sell" crosses are never
    filtered. trend_period=None or 0 disables the filter. If the filter is
    on but there isn't enough history for the trend EMA, "buy" is
    suppressed -- we can't confirm the regime, so we don't enter.
    """
    raw, curr_fast, curr_slow = crossover_signal(closes, fast_period, slow_period)
    ema_trend = trend_ema_value(closes, trend_period)

    signal = raw
    if raw == "buy" and trend_period:
        in_uptrend = ema_trend is not None and closes[-1] > ema_trend
        if not in_uptrend:
            signal = "hold"
    return signal, curr_fast, curr_slow, ema_trend


# ---------------------------------------------------------------------------
# Paper fills (mirrors broker.PaperBroker.enter / .exit exactly: same
# slippage-adjusted fill price, same fee model).
# ---------------------------------------------------------------------------


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _utcnow_date_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def enter_position(state, symbol, current_price, quote_amount, fee_pct, slippage_pct,
                   stop_loss_pct, stop_loss_price=None):
    fill_price = current_price * (1 + slippage_pct)
    fee = quote_amount * fee_pct
    base_amount = (quote_amount - fee) / fill_price
    stop_px = fill_price * (1 - stop_loss_pct) if stop_loss_price is None else stop_loss_price

    state["quote_balance"] -= quote_amount
    state["base_balance"] += base_amount
    state["position"] = {
        "symbol": symbol,
        "entry_price": fill_price,
        "entry_time": _utcnow_iso(),
        "base_amount": base_amount,
        "quote_spent": quote_amount,
        "stop_loss_price": stop_px,
        "highest_price": fill_price,
    }


def exit_position(state, current_price, reason, fee_pct, slippage_pct):
    position = state["position"]
    fill_price = current_price * (1 - slippage_pct)
    gross = position["base_amount"] * fill_price
    fee = gross * fee_pct
    proceeds = gross - fee
    pnl = proceeds - position["quote_spent"]

    state["quote_balance"] += proceeds
    state["base_balance"] -= position["base_amount"]
    trade = {
        "symbol": position["symbol"],
        "entry_price": position["entry_price"],
        "exit_price": fill_price,
        "entry_time": position["entry_time"],
        "exit_time": _utcnow_iso(),
        "base_amount": position["base_amount"],
        "quote_spent": position["quote_spent"],
        "quote_received": proceeds,
        "pnl_quote": pnl,
        "reason": reason,
    }
    state["trade_history"].append(trade)
    state["position"] = None
    _record_realized_pnl(state, pnl)
    return trade


def _record_realized_pnl(state, pnl_quote: float) -> None:
    if pnl_quote >= 0:
        return
    today = _utcnow_date_str()
    if state["daily_loss_date"] != today:
        state["daily_loss_date"] = today
        state["daily_realized_loss"] = 0.0
    state["daily_realized_loss"] += -pnl_quote


def check_daily_reset(state) -> None:
    today = _utcnow_date_str()
    if state["daily_loss_date"] == today:
        return
    state["daily_loss_date"] = today
    state["daily_realized_loss"] = 0.0
    if state["trading_halted"] and state["halt_reason"] == "daily_loss_limit":
        state["trading_halted"] = False
        state["halt_reason"] = None


def enforce_daily_loss_limit(state, daily_loss_limit_quote, daily_loss_limit_pct=0.0, equity=0.0) -> None:
    limit = daily_loss_limit_quote
    if daily_loss_limit_pct > 0 and equity > 0:
        limit = min(limit, equity * daily_loss_limit_pct)
    if state["daily_realized_loss"] >= limit and not state["trading_halted"]:
        state["trading_halted"] = True
        state["halt_reason"] = "daily_loss_limit"


# ---------------------------------------------------------------------------
# The poll endpoint (mirrors main.py's poll_once, condensed into one
# request/response instead of a persistent loop).
# ---------------------------------------------------------------------------


@app.route("/api/poll", methods=["POST"])
def poll():
    body = request.get_json(force=True, silent=True) or {}

    symbol = str(body.get("symbol", "BTC/USDT"))
    timeframe = str(body.get("timeframe", "1m"))
    fast_ema = int(body.get("fast_ema", 9))
    slow_ema = int(body.get("slow_ema", 21))
    trend_ema = int(body.get("trend_ema", 200))  # 0 disables the trend filter
    stop_loss_pct = float(body.get("stop_loss_pct", 0.05))
    quote_amount = float(body.get("quote_amount_per_trade", 100.0))
    fee_pct = float(body.get("fee_pct", 0.001))
    slippage_pct = float(body.get("slippage_pct", 0.0005))
    daily_loss_limit = float(body.get("daily_loss_limit_quote", 50.0))
    daily_loss_limit_pct = float(body.get("daily_loss_limit_pct", 0.0))
    starting_balance = float(body.get("starting_balance", 1000.0))
    atr_period = int(body.get("atr_period", 14))
    atr_stop_mult = float(body.get("atr_stop_mult", 1.5))    # 0 = fixed-% stop
    atr_trail_mult = float(body.get("atr_trail_mult", 2.0))  # 0 = no trailing
    risk_per_trade_pct = float(body.get("risk_per_trade_pct", 0.0))  # 0 = flat quote_amount
    max_position_pct_equity = float(body.get("max_position_pct_equity", 1.0))

    if fast_ema < 1 or slow_ema < 1 or fast_ema >= slow_ema:
        return jsonify({"error": "fast_ema must be positive and less than slow_ema"}), 400
    if trend_ema < 0:
        return jsonify({"error": "trend_ema must be 0 (off) or a positive number of candles"}), 400
    if atr_stop_mult < 0 or atr_trail_mult < 0 or risk_per_trade_pct < 0:
        return jsonify({"error": "ATR multiples and risk % must be 0 or positive"}), 400
    trend_period = trend_ema or None

    state = {**DEFAULT_STATE, **(body.get("state") or {})}
    if state["quote_balance"] is None:
        state["quote_balance"] = starting_balance

    binance_symbol = symbol.replace("/", "").upper()

    try:
        klines = fetch_klines(binance_symbol, timeframe, limit=500)
        current_price = fetch_price(binance_symbol)
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as exc:
        return jsonify({"error": f"Market data request failed: {exc}", "state": state}), 502

    if not isinstance(klines, list) or len(klines) < 2:
        return jsonify({"error": f"Unexpected market data response for {symbol} {timeframe}", "state": state}), 502

    # Drop the in-progress candle -- see strategy.drop_unclosed_candle()'s
    # docstring in the root bot for why this matters.
    closed_klines = klines[:-1]
    closes = [float(row[4]) for row in closed_klines]
    highs = [float(row[2]) for row in closed_klines]
    lows = [float(row[3]) for row in closed_klines]
    last_closed_open_time = int(closed_klines[-1][0])

    atr_by_row = compute_atr_series(highs, lows, closes, atr_period)
    atr = atr_by_row[-1] if atr_by_row and atr_by_row[-1] is not None else None

    check_daily_reset(state)
    if state["first_price_seen"] is None:
        state["first_price_seen"] = current_price

    log = {
        "timestamp": _utcnow_iso(),
        "price": current_price,
        "ema_fast": None,
        "ema_slow": None,
        "ema_trend": None,
        "atr": atr,
        "signal": "hold",
        "action": "none",
        "message": "",
    }

    # --- Trailing stop + hard stop-loss: checked on every poll. ---
    pos = state["position"]
    if pos is not None:
        pos["highest_price"] = max(pos.get("highest_price") or pos["entry_price"], current_price)
        trailed = trailed_stop_price(pos["stop_loss_price"], pos["highest_price"], atr, atr_trail_mult)
        if trailed > pos["stop_loss_price"]:
            pos["stop_loss_price"] = trailed

    if state["position"] is not None and current_price <= state["position"]["stop_loss_price"]:
        pos = state["position"]
        reason = "trailing_stop" if pos["stop_loss_price"] > pos["entry_price"] else "stop_loss"
        trade = exit_position(state, current_price, reason, fee_pct, slippage_pct)
        equity_now = state["quote_balance"] + state["base_balance"] * current_price
        enforce_daily_loss_limit(state, daily_loss_limit, daily_loss_limit_pct, equity_now)
        log["action"] = f"{reason}_exit"
        label = "Trailing stop" if reason == "trailing_stop" else "Stop-loss"
        log["message"] = f"{label} hit at {current_price:.6f} -- exited, pnl {trade['pnl_quote']:+.4f}"

    # --- Act once per closed candle, not once per poll. ---
    new_candle = last_closed_open_time != state["last_processed_candle_ts"]
    if new_candle:
        state["last_processed_candle_ts"] = last_closed_open_time

        if len(closes) < slow_ema + 1:
            log["message"] = f"Warming up: {len(closes)}/{slow_ema + 1} closed candles"
        else:
            signal, ema_fast, ema_slow, ema_trend = generate_signal(closes, fast_ema, slow_ema, trend_period)
            raw_signal, _, _ = crossover_signal(closes, fast_ema, slow_ema)
            log["signal"], log["ema_fast"], log["ema_slow"] = signal, ema_fast, ema_slow
            log["ema_trend"] = ema_trend

            buy_blocked_by_trend = bool(trend_period) and raw_signal == "buy" and signal == "hold"

            if state["trading_halted"]:
                log["message"] = f"Trading halted ({state['halt_reason']}) -- signal '{signal}' ignored"
            elif buy_blocked_by_trend and ema_trend is not None:
                log["message"] = (
                    f"Buy cross ignored: price {closes[-1]:.6f} is below the {trend_ema}-EMA "
                    f"trend line ({ema_trend:.6f}) -- not an uptrend"
                )
            elif buy_blocked_by_trend:
                log["message"] = f"Buy cross ignored: not enough history yet for the {trend_ema}-EMA trend filter"
            elif signal == "buy" and state["position"] is None:
                stop_px = initial_stop_price(current_price, atr, atr_stop_mult, stop_loss_pct)
                equity_now = state["quote_balance"]
                size = position_quote(
                    equity_now, current_price, stop_px, risk_per_trade_pct,
                    quote_amount, equity_now, max_position_pct_equity,
                )
                if 0 < size <= state["quote_balance"]:
                    enter_position(
                        state, symbol, current_price, size, fee_pct, slippage_pct, stop_loss_pct, stop_px
                    )
                    log["action"] = "entered"
                    log["message"] = f"Entered long at {current_price:.6f} (stop {stop_px:.6f}, spent {size:.2f})"
                else:
                    log["message"] = "Buy signal, but paper balance is below the trade size"
            elif signal == "sell" and state["position"] is not None:
                trade = exit_position(state, current_price, "signal", fee_pct, slippage_pct)
                equity_now = state["quote_balance"] + state["base_balance"] * current_price
                enforce_daily_loss_limit(state, daily_loss_limit, daily_loss_limit_pct, equity_now)
                log["action"] = "exited"
                log["message"] = f"Exited on sell signal at {current_price:.6f}, pnl {trade['pnl_quote']:+.4f}"
            else:
                log["message"] = f"New candle closed: signal '{signal}', no action"
    else:
        log["message"] = "Waiting for the next candle to close"

    equity = state["quote_balance"] + state["base_balance"] * current_price
    buy_hold_return_pct = (current_price / state["first_price_seen"] - 1) * 100

    return jsonify(
        {
            "state": state,
            "log": log,
            "equity": equity,
            "current_price": current_price,
            "total_return_pct": (equity / starting_balance - 1) * 100,
            "buy_hold_return_pct": buy_hold_return_pct,
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5001)
