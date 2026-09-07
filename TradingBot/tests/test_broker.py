import pytest

from broker import InsufficientBalanceError, PaperBroker
from config import Config, ExchangeConfig, RiskConfig, RuntimeConfig, StrategyConfig
from state import BotState


def make_config(tmp_path, starting_balance: float = 1000.0) -> Config:
    return Config(
        exchange=ExchangeConfig(symbol="BTC/USDT"),
        strategy=StrategyConfig(),
        risk=RiskConfig(
            quote_amount_per_trade=100.0,
            stop_loss_pct=0.05,
            fee_pct=0.001,
            slippage_pct=0.0005,
            daily_loss_limit_quote=50.0,
        ),
        runtime=RuntimeConfig(
            paper=True,
            state_file=tmp_path / "state.json",
            paper_starting_balance_quote=starting_balance,
        ),
    )


def test_paper_broker_round_trip_pnl(tmp_path):
    # PaperBroker never touches the exchange object directly (it simulates
    # fills from the price it's given), so None stands in fine here --
    # this test needs no network access and mocks nothing exchange-related.
    config = make_config(tmp_path)
    state = BotState()
    broker = PaperBroker(config, exchange=None, state=state, state_path=config.runtime.state_file)

    broker.enter("BTC/USDT", current_price=100.0)
    assert broker.get_open_position() is not None
    assert broker.get_quote_balance() == pytest.approx(1000.0 - 100.0)

    trade = broker.exit(current_price=110.0, reason="signal")

    assert broker.get_open_position() is None
    # Bought at ~100 (plus slippage/fee), sold at ~110 (minus slippage/fee)
    # -- a 10% price move should clear costs and come out a net win.
    assert trade.pnl_quote > 0
    assert broker.get_quote_balance() == pytest.approx(1000.0 - 100.0 + trade.quote_received)
    assert state.trade_history == [trade]


def test_paper_broker_round_trip_loss_recorded_for_daily_limit(tmp_path):
    config = make_config(tmp_path)
    state = BotState()
    broker = PaperBroker(config, exchange=None, state=state, state_path=config.runtime.state_file)

    broker.enter("BTC/USDT", current_price=100.0)
    trade = broker.exit(current_price=90.0, reason="stop_loss")

    assert trade.pnl_quote < 0
    assert state.daily_realized_loss == pytest.approx(-trade.pnl_quote)


def test_paper_broker_rejects_entry_beyond_balance(tmp_path):
    config = make_config(tmp_path, starting_balance=10.0)  # less than the 100 quote_amount_per_trade
    state = BotState()
    broker = PaperBroker(config, exchange=None, state=state, state_path=config.runtime.state_file)

    with pytest.raises(InsufficientBalanceError):
        broker.enter("BTC/USDT", current_price=100.0)


def test_paper_broker_rejects_double_entry(tmp_path):
    config = make_config(tmp_path)
    state = BotState()
    broker = PaperBroker(config, exchange=None, state=state, state_path=config.runtime.state_file)

    broker.enter("BTC/USDT", current_price=100.0)
    with pytest.raises(RuntimeError):
        broker.enter("BTC/USDT", current_price=100.0)


def test_paper_broker_honours_explicit_stop_and_size(tmp_path):
    config = make_config(tmp_path)
    state = BotState()
    broker = PaperBroker(config, exchange=None, state=state, state_path=config.runtime.state_file)

    pos = broker.enter("BTC/USDT", current_price=100.0, stop_loss_price=93.0, quote_amount=40.0)

    assert pos.stop_loss_price == 93.0          # not the fixed 5% stop
    assert pos.quote_spent == 40.0              # risk-sized amount, not quote_amount_per_trade
    assert pos.highest_price == pos.entry_price
    assert broker.get_quote_balance() == pytest.approx(1000.0 - 40.0)


def test_paper_broker_defaults_match_previous_behaviour(tmp_path):
    config = make_config(tmp_path)  # stop_loss_pct=0.05, quote_amount_per_trade=100
    state = BotState()
    broker = PaperBroker(config, exchange=None, state=state, state_path=config.runtime.state_file)

    pos = broker.enter("BTC/USDT", current_price=100.0)

    assert pos.quote_spent == 100.0
    assert pos.stop_loss_price == pytest.approx(pos.entry_price * 0.95)
