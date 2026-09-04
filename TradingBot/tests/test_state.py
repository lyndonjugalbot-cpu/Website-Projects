from state import BotState, Position, load_state, save_state


def test_state_round_trip_preserves_open_position(tmp_path):
    path = tmp_path / "state.json"
    position = Position(
        symbol="BTC/USDT",
        entry_price=100.0,
        entry_time="2024-01-01T00:00:00+00:00",
        base_amount=0.5,
        quote_spent=50.0,
        stop_loss_price=95.0,
    )
    state = BotState(position=position, last_processed_candle_ts=1704067200000)

    save_state(state, path)
    loaded = load_state(path)

    assert loaded.position == position
    assert loaded.last_processed_candle_ts == 1704067200000


def test_load_state_missing_file_returns_fresh_state(tmp_path):
    state = load_state(tmp_path / "does_not_exist.json")

    assert state.position is None
    assert state.trade_history == []
    assert state.trading_halted is False


def test_save_state_is_atomic_no_leftover_tmp_file(tmp_path):
    path = tmp_path / "state.json"
    save_state(BotState(), path)

    assert path.exists()
    assert not path.with_suffix(path.suffix + ".tmp").exists()
