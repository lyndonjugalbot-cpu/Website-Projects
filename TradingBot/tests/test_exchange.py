"""
Exercises exchange.py's order-validation logic against a fake ccxt
exchange class -- no real ccxt.binance instance, no network access. The
pattern: monkeypatch the attribute exchange.py looks up on the ccxt
module (getattr(ccxt, exchange_id)) with a fake class shaped like ccxt's
unified API.
"""

import pytest

import exchange as exchange_module
from config import Config, ExchangeConfig, RiskConfig, RuntimeConfig, StrategyConfig
from exchange import Exchange, OrderValidationError


class FakeCcxtExchange:
    def __init__(self, params):
        self.params = params
        self.sandbox = False
        self._market = {
            "base": "BTC",
            "quote": "USDT",
            "limits": {"amount": {"min": 0.0001}, "cost": {"min": 10.0}},
        }

    def set_sandbox_mode(self, value):
        self.sandbox = value

    def load_markets(self):
        return {"BTC/USDT": self._market}

    def market(self, symbol):
        return self._market

    def amount_to_precision(self, symbol, amount):
        return round(amount, 6)

    def price_to_precision(self, symbol, price):
        return round(price, 2)


@pytest.fixture
def fake_exchange(monkeypatch):
    monkeypatch.setattr(exchange_module.ccxt, "binance", FakeCcxtExchange)
    config = Config(
        exchange=ExchangeConfig(exchange_id="binance", api_key="test", api_secret="test", testnet=False),
        strategy=StrategyConfig(),
        risk=RiskConfig(),
        runtime=RuntimeConfig(),
    )
    return Exchange(config)


def test_validate_order_rejects_below_min_notional(fake_exchange):
    with pytest.raises(OrderValidationError):
        fake_exchange.validate_order("BTC/USDT", amount=0.001, price=100.0)  # notional = 0.1, min is 10


def test_validate_order_rejects_below_min_amount(fake_exchange):
    with pytest.raises(OrderValidationError):
        fake_exchange.validate_order("BTC/USDT", amount=0.00001, price=100000.0)  # below min amount 0.0001


def test_validate_order_accepts_valid_order(fake_exchange):
    fake_exchange.validate_order("BTC/USDT", amount=0.001, price=20000.0)  # notional = 20, both limits satisfied
