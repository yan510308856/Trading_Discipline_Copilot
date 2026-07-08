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
def list_trades(
    database: Database,
    trade_status: Optional[schemas.TradeStatus] = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[models.Trade]:
    return trade_service.list_trades(database, trade_status, limit, offset)


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


@router.get("/rules", response_model=list[schemas.RuleDefinition])
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
    result = evaluate_trade(trade_values)
    if trade_id is not None:
        existing_rule_ids = {alert.rule_id for alert in trade.alerts}
        for alert in result["alerts"]:
            if alert["rule_id"] not in existing_rule_ids:
                database.add(
                    models.Alert(
                        trade_id=trade.id,
                        rule_id=alert["rule_id"],
                        severity=alert["severity"],
                        message=alert["message"],
                    )
                )
        database.commit()
    return result


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
