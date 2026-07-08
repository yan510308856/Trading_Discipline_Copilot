"""HTTP routes for trades, rules, reviews, and summaries."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services import review_service, summary_service, trade_service
from app.services.rule_engine import evaluate_trade, load_rules


router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.get("/trades", response_model=list[schemas.TradeRead])
def list_trades(database: Database) -> list[models.Trade]:
    return trade_service.list_trades(database)


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


@router.post("/trades/{trade_id}/cancel", response_model=schemas.TradeRead)
def cancel_trade(trade_id: int, database: Database) -> models.Trade:
    return trade_service.cancel_trade(database, trade_id)


@router.get("/rules", response_model=list[dict[str, Any]])
def get_rules() -> list[dict[str, Any]]:
    return load_rules()


def _model_values(trade: models.Trade) -> dict[str, Any]:
    return {
        column.key: getattr(trade, column.key)
        for column in inspect(models.Trade).mapper.column_attrs
    }


@router.post("/rules/evaluate", response_model=schemas.RuleEvaluationResult)
def evaluate_rules(
    request: schemas.RuleEvaluationRequest, database: Database
) -> dict[str, Any]:
    request_values = request.model_dump(exclude_none=True)
    trade_id = request_values.pop("trade_id", None)
    if trade_id is not None:
        trade = trade_service.get_trade(database, trade_id)
        trade_values = _model_values(trade) | request_values
    else:
        trade_values = {"status": "planned"} | request_values
    return evaluate_trade(trade_values)


@router.post(
    "/trades/{trade_id}/review",
    response_model=schemas.ReviewRead,
    status_code=status.HTTP_201_CREATED,
)
def create_review(
    trade_id: int, review_data: schemas.ReviewRequest, database: Database
) -> models.Review:
    return review_service.create_review(database, trade_id, review_data)


@router.get("/summary/daily", response_model=schemas.DailySummary)
def get_daily_summary(
    database: Database,
    summary_date: Optional[date] = Query(default=None, alias="date"),
) -> dict:
    return summary_service.daily_summary(database, summary_date)
