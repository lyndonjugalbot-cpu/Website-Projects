# TradingBot web (paper trading test page)

A browser dashboard that runs the same EMA-crossover logic as the CLI bot
against **live Binance prices**, trading **simulated money only**. No API
keys, no real orders, ever -- market data comes from Binance's public,
unauthenticated `data-api.binance.vision` mirror.

## Why this isn't just "run main.py with a browser in front"

The CLI bot (`main.py`) is a long-running process: it polls forever, holds
state in memory and in `bot_state.json` on disk, and sleeps between
cycles. That doesn't fit a serverless deployment -- Vercel functions have
no persistent disk, and on the free Hobby plan, Cron Jobs only fire once
a day (Pro gets per-minute cron, at $20/mo). So this page inverts who
drives the loop:

- **The browser polls**, not the server. `public/app.js` calls
  `POST /api/poll` on a timer (default every 15s) for as long as the
  page is open. Close the tab and the bot pauses -- there's no background
  process keeping it going. That's the tradeoff for running this on
  Vercel's free tier with zero setup.
- **The API is stateless.** Each `/api/poll` call gets the current
  session state in the request body and returns the next state in the
  response. `app.js` keeps that state in `localStorage` so a page
  refresh resumes where you left off (you'll need to press Start again).
- **No database.** Because state round-trips through the browser instead
  of living server-side, there's nothing to provision.

The trading logic itself -- EMA crossover, the optional long-EMA trend
filter on buys (the "Trend EMA" field; 0 turns it off), ATR-based initial
and trailing stops ("ATR stop x" / "ATR trail x"; 0 falls back to the
fixed Stop-loss %), optional risk-based position sizing ("Risk % / trade";
0 uses the flat "Quote per trade"), a percentage daily-loss cap, dropping
the in-progress candle, acting once per closed candle, checking the stop
on every poll (not just candle closes), fee/slippage-adjusted paper
fills, the daily loss limit -- is reimplemented dependency-free in
`app.py` (a line-for-line copy of `strategy.py` + `risk.py`) to keep
the serverless function light (no pandas, no ccxt), but mirrors
`strategy.py` / `broker.py` / `main.py` in the parent bot exactly. If you
change the strategy in one place, change it in the other.

## Running locally

```bash
cd web
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5001.

## Deploying to Vercel

This repo holds multiple projects, so point Vercel at this subfolder
specifically (same pattern as GSheetTool's `GSheetTool/web`):

1. `vercel` (or import the repo in the Vercel dashboard).
2. Set **Root Directory** to `TradingBot/web`.
3. Framework preset: Vercel auto-detects Flask from `requirements.txt`.
4. Deploy. No environment variables needed -- there are no secrets in this app.

## Using the page

1. Set your symbol, timeframe, EMA periods, trend-filter EMA (0 = off,
   only buy when price is above it), stop-loss % / max risk, ATR stop and
   trail multiples (0 = fixed % stop, no trailing), risk % per trade
   (0 = flat trade size), trade size, starting paper balance, daily loss
   limit and % cap, fees/slippage, and how often to poll.
2. Click **Start**. The first poll fires immediately; after that it
   repeats on your chosen interval for as long as the tab stays open.
3. Watch the equity chart, stat tiles, trade table, and live log update.
   A shorter timeframe (1m/5m) means you'll see EMA crossovers happen
   within a normal browsing session instead of waiting hours; it also
   means the strategy is reacting to much noisier price action, which is
   worth keeping in mind when you look at the results.
4. **Stop** pauses polling without losing your session; **Reset** clears
   it and unlocks the config fields for a new run.

## What this page does and doesn't tell you

Watching it "gain profit" over a short live session is a demo, not a
result -- a handful of trades on a few hours of one symbol's price action
is not evidence the strategy works. For an actual read on whether an EMA
crossover has any edge, use the parent project's `backtest.py` against
months of historical data, with fees and slippage on (the default) and
mindful of the overfitting warning attached to its parameter sweep. This
page is for watching the mechanics run correctly and getting a feel for
how the strategy behaves -- not for validating profitability.
