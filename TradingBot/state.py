"""
Load/save bot state (open position, trade history, daily loss tracking,
last-processed candle) to a JSON file on disk.

Everything here is plain dataclasses + json. No exchange/network code.
State is saved after every action that changes it (see broker.py and
main.py) so a crash or restart can pick up exactly where the bot left
off, and reconcile() in main.py can sanity-check it against the real
exchange balance on startup.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utcnow_date_str() -> str:
    """Current UTC calendar date as 'YYYY-MM-DD', used to key the daily loss limit."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@dataclass
class Position:
    symbol: str
    entry_price: float
    entry_time: str  # ISO 8601 UTC
    base_amount: float  # amount of base asset held (e.g. BTC)
    quote_spent: float  # quote spent including the simulated/actual entry fee
    stop_loss_price: float
    # Highest price seen since entry, for the ATR trailing stop. Defaults
    # to 0.0 so state files written before this field existed still load;
    # the poll loop re-seeds it to the live price on the next tick.
    highest_price: float = 0.0


@dataclass
class Trade:
    symbol: str
    entry_price: float
    exit_price: float
    entry_time: str
    exit_time: str
    base_amount: float
    quote_spent: float
    quote_received: float
    pnl_quote: float
    reason: str  # "signal" or "stop_loss"


@dataclass
class BotState:
    position: Position | None = None
    trade_history: list[Trade] = field(default_factory=list)
    last_processed_candle_ts: int | None = None

    # Daily loss limit bookkeeping. daily_loss_date is a "YYYY-MM-DD" UTC
    # string; realised losses reset whenever the current date no longer
    # matches it (see main.py).
    daily_loss_date: str | None = None
    daily_realized_loss: float = 0.0

    trading_halted: bool = False
    halt_reason: str | None = None

    # PaperBroker's virtual balances. Persisted so restarting the bot
    # mid-paper-run doesn't reset your simulated account. Unused by
    # LiveBroker, which reads real balances from the exchange instead.
    paper_quote_balance: float | None = None
    paper_base_balance: float = 0.0


def _state_to_dict(state: BotState) -> dict:
    return asdict(state)


def _dict_to_state(data: dict) -> BotState:
    position = Position(**data["position"]) if data.get("position") else None
    trades = [Trade(**t) for t in data.get("trade_history", [])]
    return BotState(
        position=position,
        trade_history=trades,
        last_processed_candle_ts=data.get("last_processed_candle_ts"),
        daily_loss_date=data.get("daily_loss_date"),
        daily_realized_loss=data.get("daily_realized_loss", 0.0),
        trading_halted=data.get("trading_halted", False),
        halt_reason=data.get("halt_reason"),
    )


def load_state(path: Path) -> BotState:
    """Load state from disk, or return a fresh BotState if none exists yet."""
    if not path.exists():
        return BotState()
    with open(path, "r") as f:
        data = json.load(f)
    return _dict_to_state(data)


def save_state(state: BotState, path: Path) -> None:
    """
    Write state to disk atomically: write to a temp file, then rename over
    the target. A crash mid-write can't leave bot_state.json truncated or
    half-written, which would otherwise be discovered the hard way on the
    next restart.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with open(tmp_path, "w") as f:
        json.dump(_state_to_dict(state), f, indent=2, default=str)
    os.replace(tmp_path, path)
