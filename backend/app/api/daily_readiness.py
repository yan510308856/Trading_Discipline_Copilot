"""Daily readiness HTTP routes."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services import daily_readiness_service


router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.get("/daily-readiness/today", response_model=schemas.DailyReadinessRead)
def get_today_daily_readiness(database: Database) -> schemas.DailyReadinessRead:
    return daily_readiness_service.get_readiness(database, date.today())


@router.get("/daily-readiness", response_model=schemas.DailyReadinessRead)
def get_daily_readiness(
    database: Database,
    readiness_date: date = Query(alias="date"),
) -> schemas.DailyReadinessRead:
    return daily_readiness_service.get_readiness(database, readiness_date)


@router.put("/daily-readiness/{readiness_date}", response_model=schemas.DailyReadinessRead)
def update_daily_readiness(
    readiness_date: date,
    readiness: schemas.DailyReadinessUpdate,
    database: Database,
) -> schemas.DailyReadinessRead:
    return daily_readiness_service.update_readiness(
        database,
        readiness_date,
        readiness,
    )
