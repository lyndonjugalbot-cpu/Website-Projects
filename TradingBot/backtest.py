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
from risk import initial_stop_price, position_quote, trailed_stop_price
from strategy import compute_atr, generate_signal

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
    trend_period: int | None = None,
    atr_period: int = 14,
    atr_stop_mult: float = 1.5,
    atr_trail_mult: float = 2.0,
    risk_per_trade_pct: float = 0.0,
    max_position_pct_equity: float = 1.0,
) -> BacktestResult:
    # Start once the slowest indicator in play (trend EMA or ATR) has
    # history to work with, so the equity curve doesn't open with a long
    # dead stretch.
    min_len = max(slow_period, trend_period or 0, atr_period + 1) + WARMUP_BUFFER
    if len(candles) <= min_len:
        empty = pd.Series(dtype=float)
        return BacktestResult([], empty, starting_equity, starting_equity)

    atr_by_row = compute_atr(candles, atr_period)

    cash = starting_equity
    position: dict | None = None  # entry_price, entry_time, base_amount, quote_spent, stop_loss_price, highest_price
    trades: list[BacktestTrade] = []
    equity_points: list[tuple[pd.Timestamp, float]] = []

    for i in range(min_len, len(candles)):
        row = candles.iloc[i]
        price = float(row["close"])
        high = float(row["high"])
        low = float(row["low"])
        ts = row["timestamp"]
        atr = atr_by_row[i]

        # --- Trail the stop up on the candle's high before checking it. ---
        if position is not None:
            position["highest_price"] = max(position["highest_price"], high)
            position["stop_loss_price"] = trailed_stop_price(
                position["stop_loss_price"], position["highest_price"], atr, atr_trail_mult
            )

        # --- Stop-loss, checked intra-candle via the low, before the signal. ---
        if position is not None and low <= position["stop_loss_price"]:
            fill_price = position["stop_loss_price"] * (1 - slippage_pct)
            gross = position["base_amount"] * fill_price
            fee = gross * fee_pct
            proceeds = gross - fee
            pnl = proceeds - position["quote_spent"]
            cash += proceeds
            reason = "trailing_stop" if position["stop_loss_price"] > position["entry_price"] else "stop_loss"
            trades.append(
                BacktestTrade(
                    entry_time=position["entry_time"],
                    exit_time=ts,
                    entry_price=position["entry_price"],
                    exit_price=fill_price,
                    pnl_quote=pnl,
                    pnl_pct=pnl / position["quote_spent"] * 100,
                    reason=reason,
                )
            )
            position = None

        window = candles.iloc[: i + 1]
        signal = generate_signal(window, fast_period, slow_period, trend_period)

        if signal == "buy" and position is None:
            fill_price = price * (1 + slippage_pct)
            stop_px = initial_stop_price(fill_price, atr, atr_stop_mult, stop_loss_pct)
            spend = position_quote(
                cash, fill_price, stop_px, risk_per_trade_pct, quote_amount, cash, max_position_pct_equity
            )
            if spend > 0:
                fee = spend * fee_pct
                bought = (spend - fee) / fill_price
                cash -= spend
                position = {
                    "entry_price": fill_price,
                    "entry_time": ts,
                    "base_amount": bought,
                    "quote_spent": spend,
                    "stop_loss_price": stop_px,
                    "highest_price": fill_price,
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
    trend: int | None = None,
    atr_stop_mult: float | None = None,
    atr_trail_mult: float | None = None,
    risk_pct: float | None = None,
) -> None:
    print("=" * 60)
    trend_desc = f"  trend EMA {trend}" if trend else "  trend filter off"
    print(f"Backtest: {symbol} {timeframe}  EMA {fast}/{slow}{trend_desc}")
    print(f"Fees: {fee_pct * 100:.3f}% per side   Slippage: {slippage_pct * 100:.3f}%")
    if atr_stop_mult is not None:
        stop_desc = f"{atr_stop_mult}x ATR" if atr_stop_mult else "fixed %"
        trail_desc = f"{atr_trail_mult}x ATR" if atr_trail_mult else "off"
        sizing = f"{risk_pct * 100:.2f}% equity/trade" if risk_pct else "fixed size"
        print(f"Stop: {stop_desc}   Trailing: {trail_desc}   Sizing: {sizing}")
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
    trend_period: int | None = None,
    atr_period: int = 14,
    atr_stop_mult: float = 1.5,
    atr_trail_mult: float = 2.0,
    risk_per_trade_pct: float = 0.0,
    max_position_pct_equity: float = 1.0,
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
                candles, fast, slow, quote_amount, stop_loss_pct, fee_pct, slippage_pct,
                starting_equity, trend_period, atr_period, atr_stop_mult, atr_trail_mult,
                risk_per_trade_pct, max_position_pct_equity,
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
    parser.add_argument(
        "--trend", type=int, default=config.strategy.trend_ema,
        help="Trend-filter EMA period: only buy when price is above it. 0 disables the filter.",
    )
    parser.add_argument("--quote-amount", type=float, default=config.risk.quote_amount_per_trade)
    parser.add_argument("--stop-loss-pct", type=float, default=config.risk.stop_loss_pct,
                        help="Stop distance / hard risk cap as a fraction below entry (0.05 = 5%%)")
    parser.add_argument("--atr-period", type=int, default=config.risk.atr_period)
    parser.add_argument("--atr-stop-mult", type=float, default=config.risk.atr_stop_mult,
                        help="Initial stop = this many ATRs below entry. 0 = use --stop-loss-pct.")
    parser.add_argument("--atr-trail-mult", type=float, default=config.risk.atr_trail_mult,
                        help="Trail the stop this many ATRs below the high-water mark. 0 = no trailing.")
    parser.add_argument("--risk-pct", type=float, default=config.risk.risk_per_trade_pct,
                        help="Fraction of equity risked per trade (0.01 = 1%%). 0 = flat --quote-amount.")
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
    trend_period = args.trend or None

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
            fee_pct, slippage_pct, args.starting_equity, trend_period,
            args.atr_period, args.atr_stop_mult, args.atr_trail_mult, args.risk_pct,
            config.risk.max_position_pct_equity,
        )
        print("\nParameter sweep results (see run_sweep()'s docstring re: overfitting):")
        print(table.to_string(index=False))
        return

    result = run_backtest(
        candles, args.fast, args.slow, args.quote_amount, args.stop_loss_pct,
        fee_pct, slippage_pct, args.starting_equity, trend_period,
        args.atr_period, args.atr_stop_mult, args.atr_trail_mult, args.risk_pct,
        config.risk.max_position_pct_equity,
    )
    buy_hold_pct = buy_and_hold_return_pct(candles)
    print_report(
        result, buy_hold_pct, args.symbol, args.timeframe, args.fast, args.slow,
        fee_pct, slippage_pct, trend_period, args.atr_stop_mult, args.atr_trail_mult, args.risk_pct,
    )


if __name__ == "__main__":
    main()
