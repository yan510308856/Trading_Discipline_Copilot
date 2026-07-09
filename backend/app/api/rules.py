"""Rule definition and rule evaluation HTTP routes."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services import trade_service
from app.services.rule_engine import evaluate_trade, load_rules


router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


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


@router.get(
    "/rules/open-attention", response_model=list[schemas.OpenTradeAttention]
)
def get_open_trade_attention(database: Database) -> list[dict[str, Any]]:
    priorities = {"blocker": 3, "warning": 2, "reminder": 1}
    attention: list[dict[str, Any]] = []
    trades = trade_service.list_trades(database, "open", None, 500, 0)
    for trade in trades:
        current_r = (
            trade_service.calculate_final_r(trade, trade.current_price)
            if trade.current_price is not None
            else None
        )
        result = evaluate_trade(_model_values(trade) | {"current_r": current_r})
        alerts = sorted(
            result["alerts"],
            key=lambda alert: priorities[alert["severity"]],
            reverse=True,
        )
        attention.append(
            {
                "trade": trade,
                "current_r": current_r,
                "status": result["status"],
                "primary_alert": alerts[0] if alerts else None,
                "alerts": alerts,
            }
        )
    return attention
