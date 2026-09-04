"""
Pulls historical OHLCV from Binance (via exchange.py) and replays it,
candle by candle, through the exact same strategy.generate_signal() the
live bot uses. Reports return vs. buy-and-hold, trade stats, and max
drawdown.

Fees and slippage are ON by default (config.risk.fee_pct / slippage_pct)
and applied to every simulated fill. A backtest that ignores them is
worse than useless: it will happily show a strategy that trades often on
thin edges as "profitable" when, after 0.1% per side plus slippage, it
actually bleeds money. Turn them off only if you specifically want to see
the strategy's raw, cost-free signal quality -- never trust an --fee 0
result as a return estimate.

The hard stop-loss is also simulated here, checked against each candle's
LOW (not just its close) since a stop can be hit intra-candle. This is a
conservative proxy, not tick-level accuracy -- OHLCV data doesn't tell us
the exact path price took within the candle, only that it touched that
low at some point.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field

import pandas as pd

from config import config
from exchange import Exchange
from strategy import generate_signal

WARMUP_BUFFER = 1  # need slow_period + 1 candles before the first signal is meaningful


@dataclass
class BacktestTrade:
    entry_time: pd.Timestamp
    exit_time: pd.Timestamp
    entry_price: float
    exit_price: float
    pnl_quote: float
    pnl_pct: float
    reason: str  # "signal" or "stop_loss" or "end_of_data"


@dataclass
class BacktestResult:
    trades: list[BacktestTrade]
    equity_curve: pd.Series
    starting_equity: float
    ending_equity: float

    @property
    def total_return_pct(self) -> float:
        return (self.ending_equity / self.starting_equity - 1) * 100

    @property
    def num_trades(self) -> int:
        return len(self.trades)

    @property
    def win_rate_pct(self) -> float:
        if not self.trades:
            return 0.0
        wins = [t for t in self.trades if t.pnl_quote > 0]
        return len(wins) / len(self.trades) * 100

    @property
    def avg_win_quote(self) -> float:
        wins = [t.pnl_quote for t in self.trades if t.pnl_quote > 0]
        return sum(wins) / len(wins) if wins else 0.0

    @property
    def avg_loss_quote(self) -> float:
        losses = [t.pnl_quote for t in self.trades if t.pnl_quote <= 0]
        return sum(losses) / len(losses) if losses else 0.0

    @property
    def max_drawdown_pct(self) -> float:
        if self.equity_curve.empty:
            return 0.0
        running_max = self.equity_curve.cummax()
        drawdown = (self.equity_curve - running_max) / running_max
        return float(drawdown.min() * 100)


def fetch_historical_ohlcv(exchange: Exchange, symbol: str, timeframe: str, since_ms: int) -> pd.DataFrame:
    """Page through ccxt's fetch_ohlcv (max ~1000 candles per call) to cover the full requested range."""
    timeframe_ms = exchange.client.parse_timeframe(timeframe) * 1000
    now_ms = exchange.client.milliseconds()

    batches: list[pd.DataFrame] = []
    since = since_ms
    while since < now_ms:
        batch = exchange.fetch_ohlcv(symbol, timeframe, limit=1000, since=since)
        if batch.empty:
            break
        batches.append(batch)
        last_ts_ms = int(batch["timestamp"].iloc[-1].timestamp() * 1000)
        if last_ts_ms <= since:
            break  # no progress -- avoid spinning forever
        since = last_ts_ms + timeframe_ms
        if len(batch) < 1000:
            break

    if not batches:
        return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])

    combined = pd.concat(batches, ignore_index=True)
    return combined.drop_duplicates(subset="timestamp").sort_values("timestamp").reset_index(drop=True)


def run_backtest(
    candles: pd.DataFrame,
    fast_period: int,
    slow_period: int,
    quote_amount: float,
    stop_loss_pct: float,
    fee_pct: float,
    slippage_pct: float,
    starting_equity: float,
) -> BacktestResult:
    min_len = slow_period + WARMUP_BUFFER
    if len(candles) <= min_len:
        empty = pd.Series(dtype=float)
        return BacktestResult([], empty, starting_equity, starting_equity)

    cash = starting_equity
    position: dict | None = None  # entry_price, entry_time, base_amount, quote_spent, stop_loss_price
    trades: list[BacktestTrade] = []
    equity_points: list[tuple[pd.Timestamp, float]] = []

    for i in range(min_len, len(candles)):
        row = candles.iloc[i]
        price = float(row["close"])
        low = float(row["low"])
        ts = row["timestamp"]

        # --- Hard stop-loss, checked intra-candle via the low, before the signal. ---
        if position is not None and low <= position["stop_loss_price"]:
            fill_price = position["stop_loss_price"] * (1 - slippage_pct)
            gross = position["base_amount"] * fill_price
            fee = gross * fee_pct
            proceeds = gross - fee
            pnl = proceeds - position["quote_spent"]
            cash += proceeds
            trades.append(
                BacktestTrade(
                    entry_time=position["entry_time"],
                    exit_time=ts,
                    entry_price=position["entry_price"],
                    exit_price=fill_price,
                    pnl_quote=pnl,
                    pnl_pct=pnl / position["quote_spent"] * 100,
                    reason="stop_loss",
                )
            )
            position = None

        window = candles.iloc[: i + 1]
        signal = generate_signal(window, fast_period, slow_period)

        if signal == "buy" and position is None:
            spend = min(quote_amount, cash)
            if spend > 0:
                fill_price = price * (1 + slippage_pct)
                fee = spend * fee_pct
                bought = (spend - fee) / fill_price
                cash -= spend
                position = {
                    "entry_price": fill_price,
                    "entry_time": ts,
                    "base_amount": bought,
                    "quote_spent": spend,
                    "stop_loss_price": fill_price * (1 - stop_loss_pct),
                }
        elif signal == "sell" and position is not None:
            fill_price = price * (1 - slippage_pct)
            gross = position["base_amount"] * fill_price
            fee = gross * fee_pct
            proceeds = gross - fee
            pnl = proceeds - position["quote_spent"]
            cash += proceeds
            trades.append(
                BacktestTrade(
                    entry_time=position["entry_time"],
                    exit_time=ts,
                    entry_price=position["entry_price"],
                    exit_price=fill_price,
                    pnl_quote=pnl,
                    pnl_pct=pnl / position["quote_spent"] * 100,
                    reason="signal",
                )
            )
            position = None

        held_value = position["base_amount"] * price if position else 0.0
        equity_points.append((ts, cash + held_value))

    # Close any position still open at the end of the data, at the last close.
    if position is not None:
        last_price = float(candles["close"].iloc[-1])
        fill_price = last_price * (1 - slippage_pct)
        gross = position["base_amount"] * fill_price
        fee = gross * fee_pct
        proceeds = gross - fee
        pnl = proceeds - position["quote_spent"]
        cash += proceeds
        trades.append(
            BacktestTrade(
                entry_time=position["entry_time"],
                exit_time=candles["timestamp"].iloc[-1],
                entry_price=position["entry_price"],
                exit_price=fill_price,
                pnl_quote=pnl,
                pnl_pct=pnl / position["quote_spent"] * 100,
                reason="end_of_data",
            )
        )
        if equity_points:
            equity_points[-1] = (equity_points[-1][0], cash)

    equity_curve = pd.Series(
        [e for _, e in equity_points], index=[t for t, _ in equity_points]
    )
    ending_equity = float(equity_curve.iloc[-1]) if not equity_curve.empty else starting_equity
    return BacktestResult(trades, equity_curve, starting_equity, ending_equity)


def buy_and_hold_return_pct(candles: pd.DataFrame) -> float:
    first_close = float(candles["close"].iloc[0])
    last_close = float(candles["close"].iloc[-1])
    return (last_close / first_close - 1) * 100


def print_report(
    result: BacktestResult,
    buy_hold_pct: float,
    symbol: str,
    timeframe: str,
    fast: int,
    slow: int,
    fee_pct: float,
    slippage_pct: float,
) -> None:
    print("=" * 60)
    print(f"Backtest: {symbol} {timeframe}  EMA {fast}/{slow}")
    print(f"Fees: {fee_pct * 100:.3f}% per side   Slippage: {slippage_pct * 100:.3f}%")
    print("-" * 60)
    print(f"Starting equity:     {result.starting_equity:,.2f}")
    print(f"Ending equity:       {result.ending_equity:,.2f}")
    print(f"Strategy return:     {result.total_return_pct:+.2f}%")
    print(f"Buy & hold return:   {buy_hold_pct:+.2f}%")
    print(f"Trades:              {result.num_trades}")
    print(f"Win rate:            {result.win_rate_pct:.1f}%")
    print(f"Avg win:             {result.avg_win_quote:+,.2f}")
    print(f"Avg loss:            {result.avg_loss_quote:+,.2f}")
    print(f"Max drawdown:        {result.max_drawdown_pct:.2f}%")
    print("=" * 60)


def run_sweep(
    candles: pd.DataFrame,
    fast_range: list[int],
    slow_range: list[int],
    quote_amount: float,
    stop_loss_pct: float,
    fee_pct: float,
    slippage_pct: float,
    starting_equity: float,
) -> pd.DataFrame:
    """
    Try every (fast, slow) combination and tabulate results.

    ****************************************************************
    WARNING -- READ BEFORE ACTING ON THIS TABLE:

    Picking whichever row has the best return on THIS historical window
    is overfitting. You are choosing parameters that were best suited to
    exactly the past you tested on -- there is no guarantee, and often no
    real reason to expect, that the same combination will do well going
    forward. A parameter sweep is useful for sanity-checking that a
    strategy isn't wildly sensitive to small changes (a good sign is a
    smooth region of similar results, not one lucky spike surrounded by
    losers). It is not a way to discover a "best" setting to trade live.
    ****************************************************************
    """
    rows = []
    for slow in slow_range:
        for fast in fast_range:
            if fast >= slow:
                continue
            result = run_backtest(
                candles, fast, slow, quote_amount, stop_loss_pct, fee_pct, slippage_pct, starting_equity
            )
            rows.append(
                {
                    "fast_ema": fast,
                    "slow_ema": slow,
                    "return_pct": round(result.total_return_pct, 2),
                    "trades": result.num_trades,
                    "win_rate_pct": round(result.win_rate_pct, 1),
                    "max_drawdown_pct": round(result.max_drawdown_pct, 2),
                }
            )
    return pd.DataFrame(rows).sort_values("return_pct", ascending=False).reset_index(drop=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backtest the EMA crossover strategy against historical Binance data")
    parser.add_argument("--symbol", default=config.exchange.symbol)
    parser.add_argument("--timeframe", default=config.strategy.timeframe)
    parser.add_argument("--days", type=int, default=180, help="How many days of history to fetch")
    parser.add_argument("--fast", type=int, default=config.strategy.fast_ema)
    parser.add_argument("--slow", type=int, default=config.strategy.slow_ema)
    parser.add_argument("--quote-amount", type=float, default=config.risk.quote_amount_per_trade)
    parser.add_argument("--stop-loss-pct", type=float, default=config.risk.stop_loss_pct)
    parser.add_argument("--starting-equity", type=float, default=1000.0)
    parser.add_argument("--fee-pct", type=float, default=config.risk.fee_pct)
    parser.add_argument("--slippage-pct", type=float, default=config.risk.slippage_pct)
    parser.add_argument("--no-fees", action="store_true", help="Zero out fees/slippage (see module docstring: don't trust this as a return estimate)")
    parser.add_argument("--sweep", action="store_true", help="Run a parameter sweep instead of a single backtest")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    fee_pct = 0.0 if args.no_fees else args.fee_pct
    slippage_pct = 0.0 if args.no_fees else args.slippage_pct

    exchange = Exchange(config)
    since_ms = exchange.client.milliseconds() - args.days * 24 * 60 * 60 * 1000
    print(f"Fetching {args.days} days of {args.symbol} {args.timeframe} candles...")
    candles = fetch_historical_ohlcv(exchange, args.symbol, args.timeframe, since_ms)
    print(f"Got {len(candles)} candles: {candles['timestamp'].iloc[0]} -> {candles['timestamp'].iloc[-1]}")

    if args.sweep:
        fast_range = [10, 15, 20, 25, 30]
        slow_range = [40, 50, 60, 80, 100]
        table = run_sweep(
            candles, fast_range, slow_range, args.quote_amount, args.stop_loss_pct,
            fee_pct, slippage_pct, args.starting_equity,
        )
        print("\nParameter sweep results (see run_sweep()'s docstring re: overfitting):")
        print(table.to_string(index=False))
        return

    result = run_backtest(
        candles, args.fast, args.slow, args.quote_amount, args.stop_loss_pct,
        fee_pct, slippage_pct, args.starting_equity,
    )
    buy_hold_pct = buy_and_hold_return_pct(candles)
    print_report(result, buy_hold_pct, args.symbol, args.timeframe, args.fast, args.slow, fee_pct, slippage_pct)


if __name__ == "__main__":
    main()
