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

The trading logic (EMA crossover, drop-the-in-progress-candle, act-once-
per-closed-candle, stop-loss checked on every call, fee/slippage-adjusted
paper fills, daily loss limit) mirrors strategy.py / broker.py / main.py
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


def fetch_klines(binance_symbol: str, interval: str, limit: int = 300) -> list[list]:
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


def generate_signal(closes: list[float], fast_period: int, slow_period: int):
    """Returns (signal, ema_fast, ema_slow). Mirrors strategy.generate_signal()."""
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


# ---------------------------------------------------------------------------
# Paper fills (mirrors broker.PaperBroker.enter / .exit exactly: same
# slippage-adjusted fill price, same fee model).
# ---------------------------------------------------------------------------


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _utcnow_date_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def enter_position(state, symbol, current_price, quote_amount, fee_pct, slippage_pct, stop_loss_pct):
    fill_price = current_price * (1 + slippage_pct)
    fee = quote_amount * fee_pct
    base_amount = (quote_amount - fee) / fill_price

    state["quote_balance"] -= quote_amount
    state["base_balance"] += base_amount
    state["position"] = {
        "symbol": symbol,
        "entry_price": fill_price,
        "entry_time": _utcnow_iso(),
        "base_amount": base_amount,
        "quote_spent": quote_amount,
        "stop_loss_price": fill_price * (1 - stop_loss_pct),
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


def enforce_daily_loss_limit(state, daily_loss_limit_quote: float) -> None:
    if state["daily_realized_loss"] >= daily_loss_limit_quote and not state["trading_halted"]:
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
    timeframe = str(body.get("timeframe", "1h"))
    fast_ema = int(body.get("fast_ema", 20))
    slow_ema = int(body.get("slow_ema", 50))
    stop_loss_pct = float(body.get("stop_loss_pct", 0.05))
    quote_amount = float(body.get("quote_amount_per_trade", 100.0))
    fee_pct = float(body.get("fee_pct", 0.001))
    slippage_pct = float(body.get("slippage_pct", 0.0005))
    daily_loss_limit = float(body.get("daily_loss_limit_quote", 50.0))
    starting_balance = float(body.get("starting_balance", 1000.0))

    if fast_ema < 1 or slow_ema < 1 or fast_ema >= slow_ema:
        return jsonify({"error": "fast_ema must be positive and less than slow_ema"}), 400

    state = {**DEFAULT_STATE, **(body.get("state") or {})}
    if state["quote_balance"] is None:
        state["quote_balance"] = starting_balance

    binance_symbol = symbol.replace("/", "").upper()

    try:
        klines = fetch_klines(binance_symbol, timeframe, limit=300)
        current_price = fetch_price(binance_symbol)
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as exc:
        return jsonify({"error": f"Market data request failed: {exc}", "state": state}), 502

    if not isinstance(klines, list) or len(klines) < 2:
        return jsonify({"error": f"Unexpected market data response for {symbol} {timeframe}", "state": state}), 502

    # Drop the in-progress candle -- see strategy.drop_unclosed_candle()'s
    # docstring in the root bot for why this matters.
    closed_klines = klines[:-1]
    closes = [float(row[4]) for row in closed_klines]
    last_closed_open_time = int(closed_klines[-1][0])

    check_daily_reset(state)
    if state["first_price_seen"] is None:
        state["first_price_seen"] = current_price

    log = {
        "timestamp": _utcnow_iso(),
        "price": current_price,
        "ema_fast": None,
        "ema_slow": None,
        "signal": "hold",
        "action": "none",
        "message": "",
    }

    # --- Hard stop-loss: checked on every poll, independent of candle closes. ---
    if state["position"] is not None and current_price <= state["position"]["stop_loss_price"]:
        trade = exit_position(state, current_price, "stop_loss", fee_pct, slippage_pct)
        enforce_daily_loss_limit(state, daily_loss_limit)
        log["action"] = "stop_loss_exit"
        log["message"] = f"Stop-loss hit at {current_price:.6f} -- exited, pnl {trade['pnl_quote']:+.4f}"

    # --- Act once per closed candle, not once per poll. ---
    new_candle = last_closed_open_time != state["last_processed_candle_ts"]
    if new_candle:
        state["last_processed_candle_ts"] = last_closed_open_time

        if len(closes) < slow_ema + 1:
            log["message"] = f"Warming up: {len(closes)}/{slow_ema + 1} closed candles"
        else:
            signal, ema_fast, ema_slow = generate_signal(closes, fast_ema, slow_ema)
            log["signal"], log["ema_fast"], log["ema_slow"] = signal, ema_fast, ema_slow

            if state["trading_halted"]:
                log["message"] = f"Trading halted ({state['halt_reason']}) -- signal '{signal}' ignored"
            elif signal == "buy" and state["position"] is None:
                if quote_amount <= state["quote_balance"]:
                    enter_position(state, symbol, current_price, quote_amount, fee_pct, slippage_pct, stop_loss_pct)
                    log["action"] = "entered"
                    log["message"] = f"Entered long at {current_price:.6f}"
                else:
                    log["message"] = "Buy signal, but paper balance is below the trade size"
            elif signal == "sell" and state["position"] is not None:
                trade = exit_position(state, current_price, "signal", fee_pct, slippage_pct)
                enforce_daily_loss_limit(state, daily_loss_limit)
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
