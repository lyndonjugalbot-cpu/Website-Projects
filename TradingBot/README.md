# TradingBot

A Binance spot trading bot: EMA crossover strategy, long-only, no leverage,
paper trading by default. Built around ccxt so the exchange is a one-line
swap, and around a strict split between pure strategy logic and I/O so the
strategy can be unit-tested and backtested without touching a network.

## How it's organized

```
config.py       All tunable parameters, plus env var loading for secrets.
strategy.py     Pure functions: candles in, "buy"/"sell"/"hold" out. No I/O.
exchange.py     ccxt wrapper: candles, prices, balances, orders, precision/limits.
broker.py       PaperBroker and LiveBroker -- identical interface, main.py doesn't
                care which one it's talking to.
state.py        Load/save open position + trade history + daily loss tracking
                to bot_state.json.
backtest.py     Replays historical candles through strategy.py, reports performance.
main.py         The live/paper run loop.
tests/          pytest, fully mocked, no network.
```

The one rule that keeps this maintainable: **strategy.py never does I/O.**
If you want to try a different strategy later (RSI, MACD, whatever), write
a new module shaped like strategy.py (DataFrame in, signal out) and swap
the import in main.py / backtest.py. Nothing else needs to change.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env with your API keys (see below)
```

## Creating a Binance API key (trade-only, no withdrawals)

1. Log into Binance -> Account -> API Management.
2. Create a new API key (label it something like "tradingbot").
3. Binance will ask you to confirm via email/2FA.
4. On the key's permission screen:
   - **Enable Reading**: on
   - **Enable Spot & Margin Trading**: on
   - **Enable Withdrawals**: **leave this OFF.** This bot never needs
     withdrawal permission, and leaving it disabled means that even if
     your key ever leaked, the worst case is someone trades with your
     funds -- they can't move them out of your account.
5. Restrict the key to your current IP address if your bot runs somewhere
   with a stable IP (a home server, a VPS). Skip this if your IP changes
   often; it's a nice-to-have, not a requirement.
6. Copy the API key and secret into `.env` as `BINANCE_API_KEY` /
   `BINANCE_API_SECRET`. Never commit `.env` -- it's already in
   `.gitignore`.

For your first live-code dry run, use **Binance's spot testnet** instead
of a real account: https://testnet.binance.vision/ generates a separate
API key/secret pair with fake funds. `USE_TESTNET=true` in `.env` (the
default) points the bot at it.

## Running the backtest

```bash
python backtest.py --days 180
python backtest.py --days 365 --symbol ETH/USDT --timeframe 4h --fast 12 --slow 26
python backtest.py --days 180 --no-fees          # see the module docstring before trusting this number
python backtest.py --days 180 --sweep            # parameter sweep table -- read the overfitting warning in backtest.py
```

Reports: total return vs. buy-and-hold over the same window, number of
trades, win rate, average win/loss, and max drawdown. Fees (0.1% per
side) and slippage (0.05%) are modeled by default -- pass `--no-fees` if
you specifically want to see the strategy's raw signal quality, but don't
mistake that number for a return estimate.

The `--sweep` table tries a range of fast/slow EMA combinations. **Do
not** pick whichever row has the best return and trade that live -- that
row was the best fit to exactly the historical window you tested on,
which is not the same as the best fit going forward. See the warning
comment in `run_sweep()` in backtest.py.

## Running in paper mode

```bash
python main.py
```

`PAPER=true` is the default in `.env.example`, so this runs against a
simulated account (starting balance set by
`paper_starting_balance_quote` in config.py) using real, live market
prices. Nothing is sent to Binance except read-only candle/price
requests. State (open position, trade history) is saved to
`bot_state.json` after every action, and logs go to both the console and
`logs/bot.log` (rotating).

## Running live

Two things both have to be true, or the bot silently falls back to paper
mode with a warning:

1. `PAPER=false` in `.env`
2. `--live` on the command line: `python main.py --live`

If both are set, you'll see a 10-second countdown before anything trades
-- Ctrl+C to abort. Start on the Binance testnet (`USE_TESTNET=true`)
before ever pointing this at a real account, and start with a small
`quote_amount_per_trade`.

## Config reference (config.py)

**ExchangeConfig**
- `exchange_id` -- ccxt exchange id. Change this one line to trade on a
  different ccxt-supported exchange.
- `symbol` -- trading pair, e.g. `"BTC/USDT"`.
- `api_key` / `api_secret` -- from `BINANCE_API_KEY` / `BINANCE_API_SECRET`
  env vars only. Never hard-code these.
- `testnet` -- from `USE_TESTNET`. Uses Binance's spot testnet instead of
  mainnet.

**StrategyConfig**
- `timeframe` -- candle size (`"1h"`, `"4h"`, `"1d"`, ...).
- `fast_ema` / `slow_ema` -- EMA crossover periods, in candles.
- `candle_limit` -- candles fetched per poll; needs headroom above
  `slow_ema` for the EMA to be meaningful.

**RiskConfig**
- `quote_amount_per_trade` -- fixed quote-currency amount spent per
  entry (e.g. 100 USDT).
- `stop_loss_pct` -- hard stop-loss as a fraction below entry (0.05 =
  5%), checked every poll cycle regardless of candle closes.
- `daily_loss_limit_quote` -- stop opening new trades for the rest of
  the UTC day once realised losses exceed this.
- `fee_pct` / `slippage_pct` -- used by both the backtester and
  PaperBroker, so paper results reflect real trading costs.

**RuntimeConfig**
- `paper` -- from `PAPER`. Safety default: `true`.
- `poll_interval_seconds` -- how often the run loop checks prices/candles.
- `paper_starting_balance_quote` -- PaperBroker's simulated starting
  balance.
- `state_file` / `log_dir` / `log_file` -- where state and logs live.
- `network_retry_attempts` / `network_retry_base_seconds` -- backoff
  behaviour for transient ccxt.NetworkError.

## Correctness details this bot handles explicitly

- **Never acts on the in-progress candle.** `strategy.drop_unclosed_candle()`
  drops the last (still-forming) row before any signal is computed.
- **Acts once per closed candle**, not once per poll -- `main.py` tracks
  `last_processed_candle_ts` in state and skips re-evaluating a candle it's
  already handled.
- **State is persisted after every action** (`bot_state.json`), so a
  crash or restart doesn't lose track of an open position.
- **Reconciles on startup** (live mode only): compares the saved position
  against the actual exchange balance and logs a loud warning if they
  disagree. It does not auto-correct -- that's a decision for a human.
- **Validates orders before sending them**: `amount_to_precision()` plus
  a check against `market['limits']` (lot size, min notional), raising a
  clear `OrderValidationError` instead of a cryptic Binance rejection.
- **Separates network errors from real errors**: `ccxt.NetworkError`
  retries with exponential backoff inside `exchange.py`;
  `ccxt.InsufficientFunds` / other `ccxt.ExchangeError`s halt the bot
  rather than retrying blindly against a broken order.

## Web test page (paper trading in a browser)

`web/` is a browser dashboard that runs the same EMA-crossover logic
against live Binance prices with simulated money -- no API keys, no real
orders. Run it locally with `cd web && python app.py`, or deploy it to
Vercel (Root Directory `TradingBot/web`). See `web/README.md` for why
it's architected the way it is (stateless API, browser-driven polling)
and what its results do and don't tell you about the strategy.

## Tests

```bash
pytest tests/ -v
```

All tests mock ccxt / the exchange entirely -- no network access required
or used. Covers: signal generation on hand-built synthetic price series
(uptrend -> one buy, reversal -> one sell, sideways chop -> none),
the in-progress-candle filter, PaperBroker P/L on a round trip, state
save/load round trip, and order validation against market limits.
