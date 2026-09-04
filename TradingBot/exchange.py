"""
Thin wrapper around ccxt. This is the only module that talks to the
network. Everything here goes through ccxt's unified API, so the exchange
this bot trades on is controlled by one setting -- config.exchange.exchange_id
-- not scattered through the codebase.

Two things live here beyond simple pass-throughs:

1. Retry logic for transient network errors (ccxt.NetworkError), with
   exponential backoff. ccxt.InsufficientFunds and other ccxt.ExchangeError
   subclasses are NOT retried here -- they mean something is actually wrong
   (bad order, no funds, rejected by the exchange) and get raised straight
   through to the caller, which should stop trading rather than hammer the
   API with the same broken request.

2. Order validation against the market's lot-size / min-notional filters
   before submission, via amount_to_precision() and market['limits']. Binance
   rejects orders that violate these with a fairly cryptic error code; we'd
   rather fail with a clear message before the order ever leaves the process.
"""

from __future__ import annotations

import logging
import time

import ccxt
import pandas as pd

from config import Config

logger = logging.getLogger("tradingbot.exchange")


class OrderValidationError(Exception):
    """Raised when an order would violate the exchange's lot-size / min-notional filters."""


def _retry_on_network_error(attempts: int, base_seconds: float):
    """
    Decorator: retry the wrapped call on ccxt.NetworkError with exponential
    backoff (base_seconds * 2**attempt). Anything else (ExchangeError,
    InsufficientFunds, etc.) is not our business here -- let it propagate
    immediately so the caller can decide to halt.
    """

    def decorator(func):
        def wrapper(*args, **kwargs):
            last_exc: Exception | None = None
            for attempt in range(attempts):
                try:
                    return func(*args, **kwargs)
                except ccxt.NetworkError as exc:
                    last_exc = exc
                    wait = base_seconds * (2**attempt)
                    logger.warning(
                        "Network error on %s (attempt %d/%d): %s -- retrying in %.1fs",
                        func.__name__,
                        attempt + 1,
                        attempts,
                        exc,
                        wait,
                    )
                    time.sleep(wait)
            logger.error("Giving up on %s after %d attempts", func.__name__, attempts)
            raise last_exc

        return wrapper

    return decorator


class Exchange:
    """Wraps a ccxt exchange instance. All prices/amounts are floats in the exchange's native units."""

    def __init__(self, config: Config):
        self.config = config
        exchange_class = getattr(ccxt, config.exchange.exchange_id)
        self.client = exchange_class(
            {
                "apiKey": config.exchange.api_key,
                "secret": config.exchange.api_secret,
                "enableRateLimit": True,
            }
        )
        if config.exchange.testnet:
            self.client.set_sandbox_mode(True)

        self._retry_attempts = config.runtime.network_retry_attempts
        self._retry_base_seconds = config.runtime.network_retry_base_seconds
        self._markets_loaded = False

    def _ensure_markets(self) -> None:
        if not self._markets_loaded:
            self._load_markets_impl()
            self._markets_loaded = True

    def _load_markets_impl(self) -> None:
        _retry_on_network_error(self._retry_attempts, self._retry_base_seconds)(
            self.client.load_markets
        )()

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int, since: int | None = None) -> pd.DataFrame:
        """
        Fetch candles as a DataFrame with columns: timestamp (UTC datetime),
        open, high, low, close, volume -- sorted oldest to newest. The last
        row is the current, still-forming candle; callers must run it
        through strategy.drop_unclosed_candle() before evaluating signals.
        """

        @_retry_on_network_error(self._retry_attempts, self._retry_base_seconds)
        def _fetch():
            return self.client.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit, since=since)

        raw = _fetch()
        df = pd.DataFrame(raw, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
        return df

    def fetch_current_price(self, symbol: str) -> float:
        """Latest traded price, used for the stop-loss check between candle closes."""

        @_retry_on_network_error(self._retry_attempts, self._retry_base_seconds)
        def _fetch():
            return self.client.fetch_ticker(symbol)

        ticker = _fetch()
        return float(ticker["last"])

    def fetch_balance(self, asset: str) -> float:
        """Free (available, non-locked-in-orders) balance of a single asset."""

        @_retry_on_network_error(self._retry_attempts, self._retry_base_seconds)
        def _fetch():
            return self.client.fetch_balance()

        balance = _fetch()
        return float(balance.get(asset, {}).get("free", 0.0))

    def get_market(self, symbol: str) -> dict:
        self._ensure_markets()
        return self.client.market(symbol)

    def amount_to_precision(self, symbol: str, amount: float) -> float:
        self._ensure_markets()
        return float(self.client.amount_to_precision(symbol, amount))

    def price_to_precision(self, symbol: str, price: float) -> float:
        self._ensure_markets()
        return float(self.client.price_to_precision(symbol, price))

    def validate_order(self, symbol: str, amount: float, price: float) -> None:
        """
        Check a prospective order against the market's lot-size and
        min-notional filters before we ever call the order endpoint.
        Raises OrderValidationError with a clear, specific message instead
        of letting Binance reject it with an opaque error code.
        """
        market = self.get_market(symbol)
        limits = market.get("limits", {})

        min_amount = (limits.get("amount") or {}).get("min")
        if min_amount is not None and amount < min_amount:
            raise OrderValidationError(
                f"Order amount {amount} {market['base']} is below the exchange minimum "
                f"of {min_amount} {market['base']} for {symbol}."
            )

        min_cost = (limits.get("cost") or {}).get("min")
        notional = amount * price
        if min_cost is not None and notional < min_cost:
            raise OrderValidationError(
                f"Order notional {notional:.8f} {market['quote']} is below the exchange "
                f"minimum of {min_cost} {market['quote']} for {symbol}. "
                f"Increase quote_amount_per_trade in config.py."
            )

    def create_market_buy_order(self, symbol: str, amount: float) -> dict:
        """
        Place a real market buy order for `amount` units of the base asset.
        Caller is responsible for computing amount from the desired quote
        spend, rounding via amount_to_precision(), and calling
        validate_order() first -- see broker.LiveBroker.enter().
        """

        @_retry_on_network_error(self._retry_attempts, self._retry_base_seconds)
        def _place():
            return self.client.create_order(symbol, "market", "buy", amount)

        return _place()

    def create_market_sell_order(self, symbol: str, amount: float) -> dict:
        """Place a real market sell order for `amount` units of the base asset."""

        @_retry_on_network_error(self._retry_attempts, self._retry_base_seconds)
        def _place():
            return self.client.create_order(symbol, "market", "sell", amount)

        return _place()
