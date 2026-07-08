"""Market-data providers and open-trade quote refresh."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.errors import APIError
from app.services.trade_service import calculate_final_r


@dataclass(frozen=True)
class Quote:
    symbol: str
    price: float
    source: str
    quoted_at: int | None = None


class MarketDataProvider(Protocol):
    def latest_quote(self, symbol: str, market: str) -> Quote | None: ...


class ManualMarketDataProvider:
    def latest_quote(self, symbol: str, market: str) -> Quote | None:
        return None


class FinnhubMarketDataProvider:
    """Fetch US stock quotes without exposing the API key to the browser."""

    BASE_URL = "https://finnhub.io/api/v1/quote"

    def __init__(self, api_key: str, cache_seconds: int = 30) -> None:
        self.api_key = api_key
        self.cache_seconds = cache_seconds
        self._cache: dict[str, tuple[float, Quote]] = {}

    def latest_quote(self, symbol: str, market: str) -> Quote | None:
        if market != "stocks":
            return None
        normalized_symbol = symbol.strip().upper()
        cached = self._cache.get(normalized_symbol)
        if cached and time.monotonic() - cached[0] < self.cache_seconds:
            return cached[1]

        request = Request(
            f"{self.BASE_URL}?{urlencode({'symbol': normalized_symbol})}",
            headers={"X-Finnhub-Token": self.api_key},
        )
        try:
            with urlopen(request, timeout=5) as response:  # noqa: S310
                payload = json.load(response)
        except HTTPError as error:
            if error.code in {401, 403}:
                raise APIError(
                    502,
                    "FINNHUB_AUTH_ERROR",
                    "Invalid Finnhub API key. Check FINNHUB_API_KEY and restart the backend.",
                )
            if error.code == 429:
                raise APIError(429, "FINNHUB_RATE_LIMIT", "Finnhub rate limit exceeded.")
            raise APIError(502, "FINNHUB_HTTP_ERROR", "Finnhub quote request failed.")
        except (URLError, TimeoutError, ValueError) as error:
            raise APIError(
                502, "FINNHUB_UNAVAILABLE", "Finnhub quote service is unavailable."
            ) from error

        price = payload.get("c")
        if not isinstance(price, (int, float)) or price <= 0:
            raise APIError(
                502,
                "FINNHUB_INVALID_QUOTE",
                f"Finnhub did not return a usable quote for {normalized_symbol}.",
            )
        quote = Quote(
            symbol=normalized_symbol,
            price=float(price),
            source="finnhub",
            quoted_at=payload.get("t") if isinstance(payload.get("t"), int) else None,
        )
        self._cache[normalized_symbol] = (time.monotonic(), quote)
        return quote


@lru_cache
def configured_market_data_provider() -> MarketDataProvider:
    api_key = os.getenv("FINNHUB_API_KEY", "").strip()
    return FinnhubMarketDataProvider(api_key) if api_key else ManualMarketDataProvider()


def refresh_open_trade_prices(
    database: Session, provider: MarketDataProvider | None = None
) -> tuple[list[models.Trade], list[dict[str, str]]]:
    provider = provider or configured_market_data_provider()
    trades = list(
        database.scalars(
            select(models.Trade)
            .where(models.Trade.status == "open")
            .order_by(models.Trade.opened_at.desc())
        )
    )
    errors: list[dict[str, str]] = []
    for trade in trades:
        try:
            quote = provider.latest_quote(trade.symbol, trade.market)
        except APIError as error:
            errors.append({"symbol": trade.symbol, "message": error.message})
            continue
        if quote is None:
            continue
        trade.current_price = quote.price
        current_r = calculate_final_r(trade, quote.price)
        trade.mfe_r = current_r if trade.mfe_r is None else max(trade.mfe_r, current_r)
        trade.mae_r = current_r if trade.mae_r is None else min(trade.mae_r, current_r)
    database.commit()
    for trade in trades:
        database.refresh(trade)
    return trades, errors
