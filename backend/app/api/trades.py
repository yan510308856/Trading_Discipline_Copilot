"""Trade lifecycle HTTP routes."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services import trade_service


router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.get("/trades", response_model=list[schemas.TradeRead])
def list_trades(
    database: Database,
    trade_status: Optional[schemas.TradeStatus] = Query(default=None, alias="status"),
    trade_horizon: Optional[schemas.TradeHorizon] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[models.Trade]:
    return trade_service.list_trades(
        database,
        trade_status,
        trade_horizon,
        limit,
        offset,
    )


@router.post(
    "/trades", response_model=schemas.TradeRead, status_code=status.HTTP_201_CREATED
)
def create_trade(
    trade_data: schemas.TradeCreate, database: Database
) -> models.Trade:
    return trade_service.create_planned_trade(database, trade_data)


@router.get("/trades/{trade_id}", response_model=schemas.TradeRead)
def get_trade(trade_id: int, database: Database) -> models.Trade:
    return trade_service.get_trade(database, trade_id)


@router.patch("/trades/{trade_id}", response_model=schemas.TradeRead)
def update_trade(
    trade_id: int, trade_data: schemas.TradePatch, database: Database
) -> models.Trade:
    return trade_service.update_trade(database, trade_id, trade_data)


@router.post("/trades/{trade_id}/open", response_model=schemas.TradeRead)
def open_trade(
    trade_id: int, trade_data: schemas.TradeOpen, database: Database
) -> models.Trade:
    return trade_service.open_trade(database, trade_id, trade_data)


@router.post("/trades/{trade_id}/close", response_model=schemas.TradeRead)
def close_trade(
    trade_id: int, trade_data: schemas.TradeClose, database: Database
) -> models.Trade:
    return trade_service.close_trade(database, trade_id, trade_data)


@router.post(
    "/trades/{trade_id}/partial-exits",
    response_model=schemas.TradeRead,
    status_code=status.HTTP_201_CREATED,
)
def record_partial_exit(
    trade_id: int, exit_data: schemas.PartialExitCreate, database: Database
) -> models.Trade:
    return trade_service.record_partial_exit(database, trade_id, exit_data)


@router.post("/trades/{trade_id}/cancel", response_model=schemas.TradeRead)
def cancel_trade(trade_id: int, database: Database) -> models.Trade:
    return trade_service.cancel_trade(database, trade_id)


@router.delete("/trades/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trade(trade_id: int, database: Database) -> None:
    trade_service.delete_trade(database, trade_id)


@router.post("/trades/{trade_id}/checklist", response_model=schemas.TradeRead)
def save_checklist(
    trade_id: int, checklist: schemas.ChecklistAnswerBatch, database: Database
) -> models.Trade:
    return trade_service.save_checklist_answers(database, trade_id, checklist.answers)
