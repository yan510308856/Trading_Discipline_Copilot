from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services.analytics_service import discipline_analytics

router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.get("/analytics/discipline", response_model=schemas.DisciplineAnalytics)
def get_discipline_analytics(
    database: Database,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    trade_horizon: Optional[schemas.TradeHorizon] = None,
    market: Optional[schemas.Market] = None,
    setup: Optional[str] = Query(default=None, max_length=64),
    market_state: Optional[schemas.MarketState] = None,
    trade_thesis: Optional[schemas.TradeThesis] = None,
    entry_trigger: Optional[schemas.EntryTrigger] = None,
    location_tag: Optional[schemas.LocationTag] = None,
) -> dict:
    return discipline_analytics(database, date_from=date_from, date_to=date_to, trade_horizon=trade_horizon, market=market, setup=setup,
                                market_state=market_state, trade_thesis=trade_thesis,
                                entry_trigger=entry_trigger, location_tag=location_tag)
