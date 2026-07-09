"""Market data HTTP routes."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services import market_data


router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.post(
    "/market-data/refresh-open", response_model=schemas.QuoteRefreshResult
)
def refresh_open_market_data(database: Database) -> dict[str, Any]:
    provider = market_data.configured_market_data_provider()
    trades, errors = market_data.refresh_open_trade_prices(database, provider)
    source = (
        "finnhub"
        if isinstance(provider, market_data.FinnhubMarketDataProvider)
        else "manual"
    )
    return {"trades": trades, "errors": errors, "source": source}


@router.get("/market-data/quote", response_model=schemas.QuoteResult)
def get_market_quote(symbol: str = Query(min_length=1, max_length=32)) -> dict[str, Any]:
    return market_data.get_quote(symbol)
