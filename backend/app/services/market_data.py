"""Market-data abstraction reserved for future live quote providers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Quote:
    symbol: str
    price: float
    source: str


class MarketDataProvider(Protocol):
    """Contract implemented later by broker or dedicated quote adapters."""

    def latest_quote(self, symbol: str, market: str) -> Quote | None: ...


class ManualMarketDataProvider:
    """Fallback provider indicating that price must be entered manually."""

    def latest_quote(self, symbol: str, market: str) -> Quote | None:
        return None
