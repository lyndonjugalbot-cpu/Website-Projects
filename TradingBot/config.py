"""
All tunable parameters live here, grouped by concern, plus the env var
loading for anything that shouldn't be hard-coded (API keys, and a couple
of deployment switches like PAPER/testnet).

Design choice: strategy/risk/runtime *values* are plain literals on the
dataclasses below, not env-var lookups. You tune the bot by editing this
file, not by hunting through a .env for numbers. Only things that are
secret (API keys) or that change between "my laptop" and "a server"
(paper vs live, testnet vs mainnet) come from the environment.

Every other module imports a single `config` instance from here and reads
`config.strategy.fast_ema`, `config.risk.stop_loss_pct`, etc.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # reads .env in the working directory, if present

BASE_DIR = Path(__file__).resolve().parent


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class ExchangeConfig:
    # ccxt exchange id. This is the "one line" you change to swap exchanges,
    # e.g. "kraken" or "coinbase" -- everything downstream goes through ccxt's
    # unified API so exchange.py shouldn't need to change.
    exchange_id: str = "binance"

    # Trading pair in ccxt's unified format ("BASE/QUOTE").
    symbol: str = "BTC/USDT"

    # Secrets: environment only. Never given a real default, never logged,
    # never written to state.json. See .env.example.
    api_key: str = os.getenv("BINANCE_API_KEY", "")
    api_secret: str = os.getenv("BINANCE_API_SECRET", "")

    # Binance's spot testnet. Separate keys from mainnet -- get them at
    # https://testnet.binance.vision/. Recommended before ever using --live.
    testnet: bool = _env_bool("USE_TESTNET", True)


@dataclass(frozen=True)
class StrategyConfig:
    # Candle size. Bigger timeframes = fewer, more reliable signals and
    # slower reaction; smaller = noisier and more prone to whipsaw.
    timeframe: str = "1h"

    # EMA crossover periods, in candles. Fast crossing above slow = buy
    # signal; fast crossing below slow = sell signal.
    fast_ema: int = 20
    slow_ema: int = 50

    # Candles fetched per poll. Needs enough history for the slow EMA to
    # stabilize (EMAs are influenced by all prior data, but the influence
    # of very old candles decays quickly) -- 300 is comfortable headroom
    # for the default slow_ema=50.
    candle_limit: int = 300


@dataclass(frozen=True)
class RiskConfig:
    # Fixed quote-currency amount spent per entry (e.g. 100 USDT buys
    # whatever that's worth in BTC at the time). Simple and predictable;
    # no position sizing based on volatility or account %, by design.
    quote_amount_per_trade: float = 100.0

    # Hard stop-loss as a fraction below entry price (0.05 = 5%). Checked
    # every poll cycle, independent of candle closes or EMA signals --
    # this is a safety net, not a strategy signal.
    stop_loss_pct: float = 0.05

    # If realised losses (sum of negative P/L from closed trades) exceed
    # this many quote-currency units in a calendar day, trading halts
    # until the next day. Resets at UTC midnight.
    daily_loss_limit_quote: float = 50.0

    # Backtest realism. Both ON by default -- see the module docstring in
    # backtest.py for why an unrealistic backtest is actively misleading.
    fee_pct: float = 0.001      # 0.1% per side (Binance spot default)
    slippage_pct: float = 0.0005  # 0.05%, applied against you on both entry and exit


@dataclass(frozen=True)
class RuntimeConfig:
    # SAFETY DEFAULT: paper trading. Flipping this to False is not enough
    # on its own to trade real money -- main.py also requires --live on
    # the command line. Both gates must agree.
    paper: bool = _env_bool("PAPER", True)

    poll_interval_seconds: int = 60

    # Starting virtual quote-currency balance for PaperBroker. Irrelevant
    # for LiveBroker, which reads your real exchange balance instead.
    paper_starting_balance_quote: float = 1000.0

    state_file: Path = BASE_DIR / "bot_state.json"

    log_dir: Path = BASE_DIR / "logs"
    log_file: Path = BASE_DIR / "logs" / "bot.log"
    log_max_bytes: int = 5_000_000
    log_backup_count: int = 5

    # Retry behaviour for ccxt.NetworkError (timeouts, DNS blips, etc).
    # Exponential backoff: attempt N waits network_retry_base_seconds * 2**N.
    network_retry_attempts: int = 5
    network_retry_base_seconds: float = 2.0


@dataclass(frozen=True)
class Config:
    exchange: ExchangeConfig
    strategy: StrategyConfig
    risk: RiskConfig
    runtime: RuntimeConfig


def load_config() -> Config:
    """Single entry point every other module uses to get settings."""
    return Config(
        exchange=ExchangeConfig(),
        strategy=StrategyConfig(),
        risk=RiskConfig(),
        runtime=RuntimeConfig(),
    )


config = load_config()
