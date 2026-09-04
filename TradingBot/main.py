"""
The run loop. Polls the exchange, evaluates strategy.py on closed candles,
checks the hard stop-loss on every poll (not just candle closes), and
drives whichever broker is active -- main.py never checks whether it's
talking to PaperBroker or LiveBroker; see broker.py for why.

SAFETY GATE: live trading requires BOTH config.runtime.paper == False
(set via PAPER=false in the environment) AND --live on the command line.
If either is missing, this runs in paper mode -- see resolve_trading_mode().
"""

from __future__ import annotations

import argparse
import logging
import logging.handlers
import sys
import time

import ccxt

from broker import InsufficientBalanceError, LiveBroker, PaperBroker
from config import config
from exchange import Exchange, OrderValidationError
from state import load_state, save_state, utcnow_date_str
from strategy import drop_unclosed_candle, generate_signal, latest_ema_values

logger = logging.getLogger("tradingbot")


def setup_logging() -> None:
    """Console + rotating file handler, so an overnight run can be audited afterwards."""
    config.runtime.log_dir.mkdir(parents=True, exist_ok=True)
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")

    console = logging.StreamHandler()
    console.setFormatter(fmt)
    logger.addHandler(console)

    file_handler = logging.handlers.RotatingFileHandler(
        config.runtime.log_file,
        maxBytes=config.runtime.log_max_bytes,
        backupCount=config.runtime.log_backup_count,
    )
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="EMA-crossover Binance spot trading bot")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Enable live trading. Also requires PAPER=false in the environment/config -- "
        "passing this flag alone is not enough.",
    )
    return parser.parse_args()


def resolve_trading_mode(live_flag: bool) -> bool:
    """Return True to run in PAPER mode, False for LIVE. Both gates must agree to go live."""
    if config.runtime.paper and live_flag:
        logger.warning("--live was passed but config.runtime.paper is True (PAPER=true). Running in PAPER mode.")
        return True
    if not config.runtime.paper and not live_flag:
        logger.warning("PAPER=false is set but --live was not passed. Running in PAPER mode for safety.")
        return True
    return config.runtime.paper


def live_countdown(seconds: int = 10) -> None:
    print("=" * 70)
    print("!! LIVE TRADING ENABLED -- REAL ORDERS WILL BE PLACED WITH REAL MONEY !!")
    print(f"Symbol: {config.exchange.symbol}   Quote per trade: {config.risk.quote_amount_per_trade}")
    print(f"Exchange: {config.exchange.exchange_id}   Testnet: {config.exchange.testnet}")
    print("Press Ctrl+C now to abort.")
    print("=" * 70)
    for remaining in range(seconds, 0, -1):
        print(f"Starting in {remaining}...", end="\r", flush=True)
        time.sleep(1)
    print(" " * 20, end="\r")


def reconcile(broker, paper: bool) -> None:
    """
    On startup, compare saved state against the real exchange balance and
    warn loudly if they disagree -- e.g. the bot thinks it holds a
    position but the coins aren't there (sold manually, or another
    process touched the account), or vice versa. Doesn't halt anything;
    it's a loud warning for a human to look at, since automatically
    "fixing" a position mismatch could easily make things worse.
    """
    if paper:
        return

    position = broker.get_open_position()
    base, _ = (position.symbol if position else config.exchange.symbol).split("/")
    actual_balance = broker.exchange.fetch_balance(base)

    if position is None:
        if actual_balance > 0:
            logger.warning(
                "RECONCILE: state.json shows no open position, but the exchange reports a free "
                "balance of %.8f %s. This bot did not open that position -- verify your account manually.",
                actual_balance, base,
            )
        else:
            logger.info("Reconcile OK: no open position, no free %s balance.", base)
        return

    drift = abs(actual_balance - position.base_amount)
    tolerance = max(position.base_amount * 0.01, 1e-8)  # 1% tolerance for fee rounding etc.
    if drift > tolerance:
        logger.warning(
            "RECONCILE: state.json expects an open position of %.8f %s, but the exchange reports "
            "a free balance of %.8f %s. State may be stale -- verify your account manually before "
            "letting this bot trade.",
            position.base_amount, base, actual_balance, base,
        )
    else:
        logger.info("Reconcile OK: open position matches exchange balance within tolerance.")


def check_daily_reset(state) -> None:
    """
    Roll the daily loss counter over at UTC midnight, and lift a halt that
    was caused by the daily loss limit (not other halt reasons) once the
    new day starts.
    """
    today = utcnow_date_str()
    if state.daily_loss_date == today:
        return
    state.daily_loss_date = today
    state.daily_realized_loss = 0.0
    if state.trading_halted and state.halt_reason == "daily_loss_limit":
        state.trading_halted = False
        state.halt_reason = None
        logger.info("New UTC trading day -- daily loss limit halt lifted.")


def enforce_daily_loss_limit(state) -> None:
    limit = config.risk.daily_loss_limit_quote
    if state.daily_realized_loss >= limit and not state.trading_halted:
        state.trading_halted = True
        state.halt_reason = "daily_loss_limit"
        logger.error(
            "Daily loss limit hit: realised losses today are %.2f (limit %.2f). "
            "Halting new trades until the next UTC day.",
            state.daily_realized_loss, limit,
        )


def poll_once(exchange: Exchange, broker, state, paper: bool) -> None:
    symbol = config.exchange.symbol
    timeframe = config.strategy.timeframe

    raw_candles = exchange.fetch_ohlcv(symbol, timeframe, config.strategy.candle_limit)
    closed_candles = drop_unclosed_candle(raw_candles)

    current_price = exchange.fetch_current_price(symbol)
    position = broker.get_open_position()

    # --- Hard stop-loss: checked every poll, independent of candle closes. ---
    if position is not None and current_price <= position.stop_loss_price:
        logger.warning(
            "STOP-LOSS triggered: price %.8f <= stop %.8f (entry %.8f). Exiting.",
            current_price, position.stop_loss_price, position.entry_price,
        )
        trade = broker.exit(current_price, reason="stop_loss")
        logger.info("Exited via stop-loss: pnl=%.4f %s", trade.pnl_quote, symbol.split("/")[1])
        enforce_daily_loss_limit(state)
        save_state(state, config.runtime.state_file)
        position = None

    if len(closed_candles) == 0:
        logger.warning("Not enough candle data yet (0 closed candles) -- skipping signal evaluation this poll.")
        return

    last_closed_ts = int(closed_candles["timestamp"].iloc[-1].timestamp() * 1000)

    # --- Act once per closed candle, not once per poll. ---
    if last_closed_ts == state.last_processed_candle_ts:
        logger.debug("Last closed candle (%s) already processed -- no new signal this poll.", last_closed_ts)
        return

    signal = generate_signal(closed_candles, config.strategy.fast_ema, config.strategy.slow_ema)
    ema_fast, ema_slow = latest_ema_values(closed_candles, config.strategy.fast_ema, config.strategy.slow_ema)
    close_price = float(closed_candles["close"].iloc[-1])

    logger.info(
        "New closed candle: close=%.8f ema_fast=%.8f ema_slow=%.8f signal=%s position_open=%s",
        close_price, ema_fast, ema_slow, signal, position is not None,
    )

    state.last_processed_candle_ts = last_closed_ts

    if state.trading_halted:
        logger.warning("Trading is halted (%s) -- signal '%s' ignored.", state.halt_reason, signal)
        save_state(state, config.runtime.state_file)
        return

    if signal == "buy" and position is None:
        try:
            new_position = broker.enter(symbol, current_price)
            logger.info(
                "ENTERED long: %.8f %s at %.8f (stop-loss %.8f)",
                new_position.base_amount, symbol.split("/")[0], new_position.entry_price, new_position.stop_loss_price,
            )
        except InsufficientBalanceError as exc:
            logger.error("Cannot enter position: %s", exc)
        except OrderValidationError as exc:
            logger.error("Order rejected by pre-flight validation: %s", exc)
    elif signal == "sell" and position is not None:
        trade = broker.exit(current_price, reason="signal")
        logger.info("EXITED via signal: pnl=%.4f %s", trade.pnl_quote, symbol.split("/")[1])
        enforce_daily_loss_limit(state)

    save_state(state, config.runtime.state_file)


def run() -> None:
    setup_logging()
    args = parse_args()
    paper = resolve_trading_mode(args.live)

    if not paper:
        live_countdown(10)

    logger.info(
        "Starting TradingBot: mode=%s symbol=%s timeframe=%s fast_ema=%d slow_ema=%d exchange=%s testnet=%s",
        "PAPER" if paper else "LIVE",
        config.exchange.symbol,
        config.strategy.timeframe,
        config.strategy.fast_ema,
        config.strategy.slow_ema,
        config.exchange.exchange_id,
        config.exchange.testnet,
    )

    exchange = Exchange(config)
    state = load_state(config.runtime.state_file)
    broker_cls = PaperBroker if paper else LiveBroker
    broker = broker_cls(config, exchange, state, config.runtime.state_file)

    reconcile(broker, paper)
    check_daily_reset(state)
    save_state(state, config.runtime.state_file)

    while True:
        try:
            check_daily_reset(state)
            poll_once(exchange, broker, state, paper)
        except KeyboardInterrupt:
            logger.info("Shutdown requested (Ctrl+C). Saving state and exiting.")
            save_state(state, config.runtime.state_file)
            sys.exit(0)
        except ccxt.InsufficientFunds as exc:
            logger.critical("InsufficientFunds from exchange: %s. Halting trading.", exc)
            state.trading_halted = True
            state.halt_reason = "insufficient_funds"
            save_state(state, config.runtime.state_file)
            sys.exit(1)
        except ccxt.ExchangeError as exc:
            logger.critical("ExchangeError: %s. Halting trading rather than retrying blindly.", exc)
            state.trading_halted = True
            state.halt_reason = f"exchange_error: {exc}"
            save_state(state, config.runtime.state_file)
            sys.exit(1)
        except ccxt.NetworkError as exc:
            # exchange.py already retries transient network errors internally;
            # reaching here means retries were exhausted. Log and try again
            # next poll rather than crashing the whole bot over a blip.
            logger.error("Network error persisted after retries: %s. Will try again next poll.", exc)

        time.sleep(config.runtime.poll_interval_seconds)


if __name__ == "__main__":
    run()
