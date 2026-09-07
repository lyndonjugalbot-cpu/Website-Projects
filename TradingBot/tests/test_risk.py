from risk import initial_stop_price, position_quote, trailed_stop_price


# --- initial_stop_price ---------------------------------------------------------


def test_initial_stop_uses_atr_when_tighter_than_the_cap():
    # 1.5 * ATR(2) = 3 below entry -> stop at 97, well inside the 5% cap (95).
    assert initial_stop_price(100.0, atr=2.0, atr_stop_mult=1.5, max_stop_pct=0.05) == 97.0


def test_initial_stop_is_capped_at_max_stop_pct():
    # 1.5 * ATR(10) = 15 below entry would be 85, but the 5% cap clamps it to 95.
    assert initial_stop_price(100.0, atr=10.0, atr_stop_mult=1.5, max_stop_pct=0.05) == 95.0


def test_initial_stop_falls_back_to_fixed_pct_without_atr():
    assert initial_stop_price(100.0, atr=None, atr_stop_mult=1.5, max_stop_pct=0.05) == 95.0


def test_initial_stop_falls_back_to_fixed_pct_when_mult_is_zero():
    assert initial_stop_price(100.0, atr=2.0, atr_stop_mult=0.0, max_stop_pct=0.05) == 95.0


# --- trailed_stop_price -------------------------------------------------------


def test_trailed_stop_ratchets_up_under_the_high_water_mark():
    # high 110, 2 * ATR(2) = 4 below it -> 106, above the current 95 stop.
    assert trailed_stop_price(95.0, highest_price_since_entry=110.0, atr=2.0, atr_trail_mult=2.0) == 106.0


def test_trailed_stop_never_lowers():
    assert trailed_stop_price(106.0, highest_price_since_entry=108.0, atr=2.0, atr_trail_mult=2.0) == 106.0


def test_trailed_stop_noop_without_atr_or_mult():
    assert trailed_stop_price(95.0, highest_price_since_entry=110.0, atr=None, atr_trail_mult=2.0) == 95.0
    assert trailed_stop_price(95.0, highest_price_since_entry=110.0, atr=2.0, atr_trail_mult=0.0) == 95.0


# --- position_quote ----------------------------------------------------------


def test_position_quote_sizes_to_the_risk_budget():
    # Risk 1% of 1000 = 10 quote; stop 2 below a 100 entry -> 10 * 100 / 2 = 500.
    size = position_quote(
        equity=1000.0, entry_price=100.0, stop_loss_price=98.0,
        risk_per_trade_pct=0.01, fallback_quote=100.0, available_quote=1000.0,
    )
    assert size == 500.0


def test_position_quote_falls_back_to_flat_size_when_risk_pct_is_zero():
    size = position_quote(
        equity=1000.0, entry_price=100.0, stop_loss_price=98.0,
        risk_per_trade_pct=0.0, fallback_quote=100.0, available_quote=1000.0,
    )
    assert size == 100.0


def test_position_quote_is_clamped_to_available_quote():
    # Tight stop wants a huge position; only 300 quote is on hand.
    size = position_quote(
        equity=1000.0, entry_price=100.0, stop_loss_price=99.0,
        risk_per_trade_pct=0.05, fallback_quote=100.0, available_quote=300.0,
    )
    assert size == 300.0


def test_position_quote_respects_max_position_pct_equity():
    size = position_quote(
        equity=1000.0, entry_price=100.0, stop_loss_price=99.0,
        risk_per_trade_pct=0.05, fallback_quote=100.0, available_quote=1000.0,
        max_position_pct_equity=0.5,
    )
    assert size == 500.0
