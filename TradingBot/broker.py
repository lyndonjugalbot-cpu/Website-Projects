"""
PaperBroker and LiveBroker expose an identical interface:

    get_open_position() -> Position | None
    get_quote_balance() -> float
    enter(symbol, current_price) -> Position
    exit(current_price, reason) -> Trade

main.py talks to whichever one it was given and never checks which class
it is -- that's the whole point of the split. Both:

- persist every change to state.py's BotState immediately (save_state
  after every enter/exit), so a crash never loses track of a position.
- record realised P/L into state.daily_realized_loss so main.py can
  enforce the daily loss limit.

PaperBroker simulates fills using the SAME fee_pct / slippage_pct model
as the backtester, applied to real, live market prices fetched from the
exchange. Without that, paper trading would look better than live trading
ever will, which defeats the point of paper trading as a rehearsal.

LiveBroker places real orders through exchange.py, using
amount_to_precision() and validate_order() before every order so Binance's
lot-size / min-notional filters are checked locally with a clear error
instead of a cryptic API rejection.
"""

from __future__ import annotations

from exchange import Exchange
from state import BotState, Position, Trade, save_state, utcnow_date_str, utcnow_iso


class InsufficientBalanceError(Exception):
    """Paper trading equivalent of ccxt.InsufficientFunds."""


def _split_symbol(symbol: str) -> tuple[str, str]:
    base, quote = symbol.split("/")
    return base, quote


class _BaseBroker:
    def __init__(self, config, exchange: Exchange, state: BotState, state_path):
        self.config = config
        self.exchange = exchange
        self.state = state
        self.state_path = state_path

    def get_open_position(self) -> Position | None:
        return self.state.position

    def _save(self) -> None:
        save_state(self.state, self.state_path)

    def _record_realized_pnl(self, pnl_quote: float) -> None:
        """
        Track today's realised losses for the daily loss limit. Only
        losses count (positive pnl doesn't offset a prior loss within the
        day) -- the limit is meant to cap how much can bleed out in a bad
        day, not a net P/L target.
        """
        if pnl_quote >= 0:
            return
        today = utcnow_date_str()
        if self.state.daily_loss_date != today:
            self.state.daily_loss_date = today
            self.state.daily_realized_loss = 0.0
        self.state.daily_realized_loss += -pnl_quote


class PaperBroker(_BaseBroker):
    def get_quote_balance(self) -> float:
        if self.state.paper_quote_balance is None:
            self.state.paper_quote_balance = self.config.runtime.paper_starting_balance_quote
        return self.state.paper_quote_balance

    def enter(self, symbol: str, current_price: float) -> Position:
        if self.state.position is not None:
            raise RuntimeError("enter() called while a position is already open")

        quote_amount = self.config.risk.quote_amount_per_trade
        balance = self.get_quote_balance()
        if quote_amount > balance:
            raise InsufficientBalanceError(
                f"Paper quote balance {balance:.2f} is less than trade size {quote_amount:.2f}"
            )

        # Buying is simulated slightly worse than the quoted price -- that's
        # what slippage means in practice.
        fill_price = current_price * (1 + self.config.risk.slippage_pct)
        fee = quote_amount * self.config.risk.fee_pct
        base_amount = (quote_amount - fee) / fill_price

        self.state.paper_quote_balance = balance - quote_amount
        self.state.paper_base_balance += base_amount

        position = Position(
            symbol=symbol,
            entry_price=fill_price,
            entry_time=utcnow_iso(),
            base_amount=base_amount,
            quote_spent=quote_amount,
            stop_loss_price=fill_price * (1 - self.config.risk.stop_loss_pct),
        )
        self.state.position = position
        self._save()
        return position

    def exit(self, current_price: float, reason: str) -> Trade:
        position = self.state.position
        if position is None:
            raise RuntimeError("exit() called with no open position")

        # Selling is simulated slightly worse than the quoted price too.
        fill_price = current_price * (1 - self.config.risk.slippage_pct)
        gross_quote = position.base_amount * fill_price
        fee = gross_quote * self.config.risk.fee_pct
        quote_received = gross_quote - fee
        pnl = quote_received - position.quote_spent

        self.state.paper_quote_balance = self.get_quote_balance() + quote_received
        self.state.paper_base_balance -= position.base_amount

        trade = Trade(
            symbol=position.symbol,
            entry_price=position.entry_price,
            exit_price=fill_price,
            entry_time=position.entry_time,
            exit_time=utcnow_iso(),
            base_amount=position.base_amount,
            quote_spent=position.quote_spent,
            quote_received=quote_received,
            pnl_quote=pnl,
            reason=reason,
        )
        self.state.trade_history.append(trade)
        self.state.position = None
        self._record_realized_pnl(pnl)
        self._save()
        return trade


class LiveBroker(_BaseBroker):
    @staticmethod
    def _fill_price(order: dict, fallback: float) -> float:
        price = order.get("average") or order.get("price")
        return float(price) if price else fallback

    @staticmethod
    def _filled_amount(order: dict, fallback: float) -> float:
        filled = order.get("filled")
        return float(filled) if filled else fallback

    @staticmethod
    def _quote_notional(order: dict, fallback: float) -> float:
        """order['cost'] is the quote-currency value of the fill (spent on a buy, received on a sell)."""
        cost = order.get("cost")
        return float(cost) if cost else fallback

    def get_quote_balance(self) -> float:
        _, quote = _split_symbol(self.config.exchange.symbol)
        return self.exchange.fetch_balance(quote)

    def enter(self, symbol: str, current_price: float) -> Position:
        if self.state.position is not None:
            raise RuntimeError("enter() called while a position is already open")

        quote_amount = self.config.risk.quote_amount_per_trade
        raw_amount = quote_amount / current_price
        amount = self.exchange.amount_to_precision(symbol, raw_amount)
        self.exchange.validate_order(symbol, amount, current_price)

        order = self.exchange.create_market_buy_order(symbol, amount)

        fill_price = self._fill_price(order, fallback=current_price)
        filled_amount = self._filled_amount(order, fallback=amount)
        quote_spent = self._quote_notional(order, fallback=fill_price * filled_amount)

        position = Position(
            symbol=symbol,
            entry_price=fill_price,
            entry_time=utcnow_iso(),
            base_amount=filled_amount,
            quote_spent=quote_spent,
            stop_loss_price=fill_price * (1 - self.config.risk.stop_loss_pct),
        )
        self.state.position = position
        self._save()
        return position

    def exit(self, current_price: float, reason: str) -> Trade:
        position = self.state.position
        if position is None:
            raise RuntimeError("exit() called with no open position")

        amount = self.exchange.amount_to_precision(position.symbol, position.base_amount)
        self.exchange.validate_order(position.symbol, amount, current_price)

        order = self.exchange.create_market_sell_order(position.symbol, amount)

        fill_price = self._fill_price(order, fallback=current_price)
        filled_amount = self._filled_amount(order, fallback=amount)
        quote_received = self._quote_notional(order, fallback=fill_price * filled_amount)
        pnl = quote_received - position.quote_spent

        trade = Trade(
            symbol=position.symbol,
            entry_price=position.entry_price,
            exit_price=fill_price,
            entry_time=position.entry_time,
            exit_time=utcnow_iso(),
            base_amount=filled_amount,
            quote_spent=position.quote_spent,
            quote_received=quote_received,
            pnl_quote=pnl,
            reason=reason,
        )
        self.state.trade_history.append(trade)
        self.state.position = None
        self._record_realized_pnl(pnl)
        self._save()
        return trade
