import pandas as pd

from strategy import drop_unclosed_candle, generate_signal


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


def signals_over_series(closes: list[float], fast: int, slow: int) -> list[str]:
    """Replay generate_signal() candle-by-candle, exactly like the live loop does."""
    candles = make_candles(closes)
    warmup = slow + 1
    return [
        generate_signal(candles.iloc[:i], fast_period=fast, slow_period=slow)
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
