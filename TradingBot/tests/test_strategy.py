import pandas as pd
import pytest

from strategy import compute_atr, drop_unclosed_candle, generate_signal, latest_atr


def make_candles(closes: list[float]) -> pd.DataFrame:
    n = len(closes)
    timestamps = pd.date_range("2024-01-01", periods=n, freq="1h", tz="UTC")
    return pd.DataFrame(
        {
            "timestamp": timestamps,
            "open": closes,
            "high": [c * 1.001 for c in closes],
            "low": [c * 0.999 for c in closes],
            "close": closes,
            "volume": [1.0] * n,
        }
    )


def signals_over_series(closes: list[float], fast: int, slow: int, trend: int | None = None) -> list[str]:
    """Replay generate_signal() candle-by-candle, exactly like the live loop does."""
    candles = make_candles(closes)
    warmup = slow + 1
    return [
        generate_signal(candles.iloc[:i], fast_period=fast, slow_period=slow, trend_period=trend)
        for i in range(warmup, len(candles) + 1)
    ]


def test_uptrend_produces_exactly_one_buy():
    flat = [100.0] * 60
    uptrend = [100.0 + i * 2 for i in range(1, 80)]
    signals = signals_over_series(flat + uptrend, fast=20, slow=50)

    assert signals.count("buy") == 1
    assert signals.count("sell") == 0


def test_reversal_produces_exactly_one_sell():
    flat = [100.0] * 60
    uptrend = [100.0 + i * 2 for i in range(1, 80)]
    downtrend = [uptrend[-1] - i * 2 for i in range(1, 80)]
    signals = signals_over_series(flat + uptrend + downtrend, fast=20, slow=50)

    assert signals.count("buy") == 1
    assert signals.count("sell") == 1


def test_sideways_chop_produces_no_signal():
    # An EMA crossover strategy is only meaningfully "tested" against chop
    # once there's an actual gap between the two EMAs to chop within --
    # on a dead-flat series both EMAs sit on top of each other and "no
    # crossing" is trivially true. So: establish a real gap with a short
    # uptrend first (one buy, expected and excluded from the assertion
    # below), then chop within a range much narrower than that gap and
    # confirm the chop itself adds no further signals.
    flat = [100.0] * 60
    uptrend = [100.0 + i * 2 for i in range(1, 40)]

    chop = []
    price = uptrend[-1]
    for i in range(150):
        price += 0.3 if i % 2 == 0 else -0.3  # oscillates well inside the fast/slow EMA gap
        chop.append(price)

    candles = make_candles(flat + uptrend + chop)
    warmup = 51
    signals = [
        generate_signal(candles.iloc[:i], fast_period=20, slow_period=50)
        for i in range(warmup, len(candles) + 1)
    ]

    setup_len = len(flat) + len(uptrend) - warmup + 1
    chop_signals = signals[setup_len:]

    assert chop_signals.count("buy") == 0
    assert chop_signals.count("sell") == 0


def test_drop_unclosed_candle_drops_last_row():
    candles = make_candles([100.0, 101.0, 102.0])
    result = drop_unclosed_candle(candles)

    assert len(result) == 2
    assert result["close"].iloc[-1] == 101.0


def test_generate_signal_holds_before_enough_history():
    candles = make_candles([100.0] * 10)
    assert generate_signal(candles, fast_period=20, slow_period=50) == "hold"


# --- Trend filter (trend_period) -------------------------------------------------


def test_trend_filter_allows_buy_when_price_is_above_trend_ema():
    # Long flat base establishes the trend EMA near 100, then a clean
    # uptrend pushes price well above it -- the buy cross should pass.
    base = [100.0] * 260
    uptrend = [100.0 + i * 2 for i in range(1, 80)]
    signals = signals_over_series(base + uptrend, fast=20, slow=50, trend=200)

    assert signals.count("buy") == 1
    assert signals.count("sell") == 0


def test_trend_filter_blocks_buy_on_a_counter_trend_bounce():
    # Trend EMA sits up near 300 (long plateau), price is dragged far below
    # it by a downtrend, then a sharp bounce triggers a fast/slow bullish
    # cross while price is still well under the trend line. Raw crossover
    # would buy here; the trend filter must suppress it.
    plateau = [300.0] * 260
    downtrend = [300.0 - i for i in range(1, 130)]
    bounce = [downtrend[-1] + i * 4 for i in range(1, 40)]

    with_filter = signals_over_series(plateau + downtrend + bounce, fast=20, slow=50, trend=200)
    without_filter = signals_over_series(plateau + downtrend + bounce, fast=20, slow=50, trend=None)

    assert without_filter.count("buy") >= 1  # the raw crossover would have entered
    assert with_filter.count("buy") == 0     # ...but the regime gate blocks it


def test_trend_filter_never_blocks_a_sell():
    base = [100.0] * 260
    uptrend = [100.0 + i * 2 for i in range(1, 80)]
    downtrend = [uptrend[-1] - i * 2 for i in range(1, 80)]
    signals = signals_over_series(base + uptrend + downtrend, fast=20, slow=50, trend=200)

    assert signals.count("buy") == 1
    assert signals.count("sell") == 1


def test_trend_period_none_matches_plain_crossover():
    base = [100.0] * 120
    uptrend = [100.0 + i * 2 for i in range(1, 80)]
    plain = signals_over_series(base + uptrend, fast=20, slow=50)
    explicit_off = signals_over_series(base + uptrend, fast=20, slow=50, trend=None)

    assert plain == explicit_off


# --- ATR (compute_atr / latest_atr) ------------------------------------------


def ohlc_frame(rows: list[tuple[float, float, float]]) -> pd.DataFrame:
    """rows are (high, low, close) tuples."""
    n = len(rows)
    return pd.DataFrame(
        {
            "timestamp": pd.date_range("2024-01-01", periods=n, freq="1h", tz="UTC"),
            "open": [c for _, _, c in rows],
            "high": [h for h, _, _ in rows],
            "low": [l for _, l, _ in rows],
            "close": [c for _, _, c in rows],
            "volume": [1.0] * n,
        }
    )


def test_compute_atr_matches_hand_calculation():
    # h/l/c per candle. TRs (from candle 1 on): 1.5, 1.5, 1.5, 2.5.
    # period=2: seed = mean(1.5, 1.5) = 1.5 at index 2;
    #           index 3 = (1.5*1 + 1.5)/2 = 1.5;
    #           index 4 = (1.5*1 + 2.5)/2 = 2.0.
    df = ohlc_frame(
        [
            (10.5, 9.5, 10.0),
            (11.5, 10.5, 11.0),
            (12.5, 11.5, 12.0),
            (11.5, 10.5, 11.0),
            (13.5, 12.5, 13.0),
        ]
    )
    atr = compute_atr(df, period=2)
    assert atr[:2] == [None, None]
    assert atr[2] == pytest.approx(1.5)
    assert atr[3] == pytest.approx(1.5)
    assert atr[4] == pytest.approx(2.0)
    assert latest_atr(df, period=2) == pytest.approx(2.0)


def test_latest_atr_none_when_history_too_short():
    df = ohlc_frame([(10.5, 9.5, 10.0), (11.0, 10.0, 10.5)])
    assert latest_atr(df, period=14) is None
