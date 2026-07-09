"""Daily summary HTTP routes."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services import summary_service


router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.get("/summary/daily", response_model=schemas.DailySummary)
def get_daily_summary(
    database: Database,
    summary_date: Optional[date] = Query(default=None, alias="date"),
    trade_horizon: Optional[schemas.TradeHorizon] = Query(default=None),
) -> dict:
    return summary_service.daily_summary(database, summary_date, trade_horizon)
