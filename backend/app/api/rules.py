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
from app.services.workflow_event_service import append_event


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
    record_attempt = bool(request_values.pop("record_attempt", False))
    planning_session_id = request_values.pop("planning_session_id", None)
    attempt_idempotency_key = request_values.pop("idempotency_key", None)
    if trade_id is not None:
        trade = trade_service.get_trade(database, trade_id)
        trade_values = _model_values(trade) | request_values
    else:
        trade_values = {"status": "planned"} | request_values
    result = evaluate_trade(trade_values)
    if record_attempt and planning_session_id and attempt_idempotency_key and result["alerts"]:
        event_type = "plan_blocked" if result["status"] == "blocked" else "plan_warning_detected"
        severities = [alert["severity"] for alert in result["alerts"]]
        append_event(
            database,
            event_type,
            severity="blocker" if event_type == "plan_blocked" else "warning",
            idempotency_key=f"plan:{planning_session_id}:{attempt_idempotency_key}:{event_type}",
            event_data={
                "rule_ids": [alert["rule_id"] for alert in result["alerts"]],
                "severity_counts": {
                    severity: severities.count(severity)
                    for severity in ("blocker", "warning", "reminder")
                },
                "horizon": trade_values.get("trade_horizon"),
                "market": trade_values.get("market"),
                "setup": trade_values.get("setup"),
                "market_state": trade_values.get("market_state"),
                "trade_thesis": trade_values.get("trade_thesis"),
                "entry_trigger": trade_values.get("entry_trigger"),
                "location_tags": trade_values.get("location_tags", []),
            },
        )
        database.commit()
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
