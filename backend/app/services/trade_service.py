"""Trade persistence and lifecycle operations."""

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.errors import APIError
from app.services.option_contract_service import (
    build_option_contract,
    resolved_underlying_direction,
    underlying_direction,
)
from app.services.workflow_event_service import append_event

logger = logging.getLogger(__name__)


def _quantity(value: float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _apply_option_contract(data: dict) -> dict:
    if data.get("market") != "options":
        data.update(option_contract=None, option_type=None, option_expiration=None, option_strike=None, option_entry_price=None)
    elif all(data.get(field) is not None for field in ("option_type", "option_expiration", "option_strike")):
        data["option_contract"] = build_option_contract(
            data["symbol"], data["option_type"], data["option_expiration"], data["option_strike"]
        )
    return data


def create_planned_trade(database: Session, trade_data: schemas.TradeCreate) -> models.Trade:
    """Persist a new trade plan in the initial planned state."""

    trade = models.Trade(**_apply_option_contract(trade_data.model_dump()), status="planned")
    database.add(trade)
    database.flush()
    append_event(
        database, "plan_created", trade_id=trade.id,
        event_data={"market": trade.market, "horizon": trade.trade_horizon, "setup": trade.setup},
    )
    database.commit()
    database.refresh(trade)
    return trade


def list_trades(
    database: Session,
    trade_status: str | None = None,
    trade_horizon: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[models.Trade]:
    statement = select(models.Trade).options(
        selectinload(models.Trade.review),
        selectinload(models.Trade.executions),
    )
    if trade_status is not None:
        statement = statement.where(models.Trade.status == trade_status)
    if trade_horizon is not None:
        statement = statement.where(models.Trade.trade_horizon == trade_horizon)
    statement = statement.order_by(models.Trade.id.desc()).limit(limit).offset(offset)
    return list(database.scalars(statement))


def get_trade(database: Session, trade_id: int) -> models.Trade:
    trade = database.get(models.Trade, trade_id)
    if trade is None:
        raise APIError(
            404,
            "TRADE_NOT_FOUND",
            f"Trade {trade_id} was not found.",
            {"trade_id": trade_id},
        )
    return trade


def update_trade(
    database: Session, trade_id: int, trade_data: schemas.TradePatch
) -> models.Trade:
    trade = get_trade(database, trade_id)
    updates = trade_data.model_dump(exclude_unset=True)
    if trade.status == "planned":
        prospective = {field: getattr(trade, field) for field in (
            "symbol", "market", "option_contract", "option_type", "option_expiration", "option_strike", "option_entry_price"
        )}
        prospective.update(updates)
        updates.update(_apply_option_contract(prospective))
    management_fields = {
        "current_stop",
        "current_price",
        "option_entry_price",
        "runner_enabled",
        "runner_active",
        "runner_stop",
        "partial_taken",
        "partial_exit_quantity",
        "position_size",
        "target_1",
        "target_2",
        "notes",
    }
    if trade.status != "planned" and not set(updates).issubset(management_fields):
        raise APIError(
            409,
            "IMMUTABLE_TRADE_FACTS",
            "Core trade plan fields cannot be changed after the trade is opened.",
            {"trade_id": trade.id, "fields": sorted(set(updates) - management_fields)},
        )
    if trade.status in {"closed", "cancelled"}:
        raise APIError(
            409,
            "INVALID_TRADE_STATE",
            "Closed or cancelled trades cannot be modified.",
            {"trade_id": trade.id, "current_status": trade.status},
        )
    partial_quantity = updates.get("partial_exit_quantity")
    if (
        partial_quantity is not None
        and trade.position_size is not None
        and partial_quantity > trade.position_size
    ):
        raise APIError(
            422,
            "INVALID_PARTIAL_QUANTITY",
            "Partial exit quantity cannot exceed the initial position size.",
            {
                "partial_exit_quantity": partial_quantity,
                "position_size": trade.position_size,
            },
        )
    if partial_quantity is not None:
        updates["partial_taken"] = partial_quantity > 0

    current_price = updates.get("current_price")
    if current_price is not None and trade.status == "open":
        current_r = calculate_final_r(trade, current_price)
        trade.mfe_r = current_r if trade.mfe_r is None else max(trade.mfe_r, current_r)
        trade.mae_r = current_r if trade.mae_r is None else min(trade.mae_r, current_r)

    if "current_price" in updates:
        updates["current_price_source"] = "manual" if updates["current_price"] is not None else None
        updates["current_price_updated_at"] = datetime.now(timezone.utc)

    for field, value in updates.items():
        setattr(trade, field, value)
    append_event(
        database, "trade_updated", trade_id=trade.id,
        event_data={"fields": sorted(updates)},
    )
    database.commit()
    database.refresh(trade)
    if "current_price" in updates:
        from app.services.price_alert_service import evaluate_trade_price_alerts
        evaluate_trade_price_alerts(database, trade)
    return trade


def _require_status(trade: models.Trade, expected: str, action: str) -> None:
    if trade.status != expected:
        raise APIError(
            409,
            "INVALID_TRADE_STATE",
            f"Only {expected} trades can be {action}.",
            {"trade_id": trade.id, "current_status": trade.status},
        )


def calculate_final_r(trade: models.Trade, exit_price: float) -> float:
    """Calculate R from entry, initial stop, direction, and exit price."""

    entry_price = (
        trade.actual_entry
        if trade.actual_entry is not None
        else trade.planned_entry
    )
    price_direction = resolved_underlying_direction(
        trade.market, trade.direction, trade.option_type, entry_price, trade.stop_loss
    )
    initial_risk = (
        entry_price - trade.stop_loss
        if price_direction == "long"
        else trade.stop_loss - entry_price
    )
    if initial_risk <= 0:
        raise APIError(
            422,
            "INVALID_RISK_DISTANCE",
            "Stop loss must define positive risk before Final R can be calculated.",
            {
                "trade_id": trade.id,
                "entry_price": entry_price,
                "stop_loss": trade.stop_loss,
            },
        )

    price_change = (
        exit_price - entry_price
        if price_direction == "long"
        else entry_price - exit_price
    )
    return round(price_change / initial_risk, 4)


def _validate_price_structure(
    direction: str, entry: float, stop: float, target: float
) -> None:
    valid = stop < entry < target if direction == "long" else target < entry < stop
    if not valid:
        raise APIError(
            422,
            "INVALID_PRICE_STRUCTURE",
            "Entry, stop, and target do not match the trade direction.",
            {"direction": direction, "entry": entry, "stop_loss": stop, "target_1": target},
        )


def _weighted_execution_r(trade: models.Trade, executions: list[models.TradeExecution]) -> float:
    if trade.position_size is None:
        raise APIError(422, "POSITION_SIZE_REQUIRED", "Position size is required to calculate weighted R.", {"trade_id": trade.id})
    total = sum((_quantity(item.quantity or 0) for item in executions), Decimal("0.00"))
    position = _quantity(trade.position_size)
    if total != position:
        raise APIError(
            409,
            "INVALID_EXECUTION_QUANTITY",
            "Recorded exit quantities must equal the initial position size before closing.",
            {"trade_id": trade.id, "recorded_quantity": float(total), "position_size": float(position)},
        )
    weighted_r = sum(
        Decimal(str(calculate_final_r(trade, item.price))) * _quantity(item.quantity or 0)
        for item in executions
    )
    return round(float(weighted_r / position), 4)


def record_partial_exit(
    database: Session, trade_id: int, exit_data: schemas.PartialExitCreate
) -> models.Trade:
    trade = get_trade(database, trade_id)
    _require_status(trade, "open", "partially exited")
    if trade.position_size is None:
        raise APIError(
            422,
            "POSITION_SIZE_REQUIRED",
            "Position size is required before recording a partial exit.",
            {"trade_id": trade.id},
        )
    exited_quantity = sum((_quantity(item.quantity or 0) for item in trade.executions), Decimal("0.00"))
    position_size = _quantity(trade.position_size)
    requested = _quantity(exit_data.quantity)
    remaining = position_size - exited_quantity
    if remaining <= 0:
        raise APIError(409, "INVALID_EXECUTION_QUANTITY", "No position quantity remains to exit.", {"trade_id": trade.id})
    if requested > remaining:
        raise APIError(
            422,
            "INVALID_PARTIAL_QUANTITY",
            "Exit quantity cannot exceed the remaining position quantity.",
            {
                "position_size": float(position_size),
                "already_exited": float(exited_quantity),
                "requested_quantity": float(requested),
                "remaining_quantity": float(remaining),
            },
        )
    is_final = requested == remaining
    execution = models.TradeExecution(
        trade=trade,
        execution_type="final" if is_final else "partial",
        price=exit_data.price,
        quantity=float(requested),
        exit_reason=exit_data.exit_reason,
        option_price=exit_data.option_price if trade.market == "options" else None,
    )
    database.add(execution)
    database.flush()
    if is_final:
        trade.exit_price = exit_data.price
        trade.exit_reason = exit_data.exit_reason
        trade.final_r = _weighted_execution_r(trade, list(trade.executions))
        trade.status = "closed"
        trade.closed_at = models.utc_now()
        trade.runner_active = False
        logger.info("trade_auto_closed trade_id=%s quantity=%s", trade.id, requested)
        append_event(
            database, "trade_auto_closed", trade_id=trade.id,
            event_data={"exit_reason": exit_data.exit_reason, "final_r": trade.final_r},
        )
    else:
        trade.partial_exit_quantity = float(exited_quantity + requested)
        trade.partial_taken = True
        append_event(
            database, "partial_exit_recorded", trade_id=trade.id,
            event_data={"quantity": float(requested), "price": exit_data.price, "exit_reason": exit_data.exit_reason},
        )
    database.commit()
    database.refresh(trade)
    return trade


def open_trade(
    database: Session, trade_id: int, trade_data: schemas.TradeOpen
) -> models.Trade:
    trade = get_trade(database, trade_id)
    _require_status(trade, "planned", "opened")
    trade.actual_entry = (
        trade.planned_entry
        if trade_data.actual_entry is None
        else trade_data.actual_entry
    )
    if trade.market == "options" and trade_data.option_entry_price is not None:
        trade.option_entry_price = round(trade_data.option_entry_price, 2)
    _validate_price_structure(
        underlying_direction(trade.market, trade.direction, trade.option_type),
        trade.actual_entry, trade.stop_loss, trade.target_1
    )
    trade.current_stop = trade.stop_loss
    trade.status = "open"
    trade.opened_at = models.utc_now()
    append_event(
        database, "trade_opened", trade_id=trade.id,
        event_data={"actual_entry": trade.actual_entry},
    )
    database.commit()
    database.refresh(trade)
    return trade


def close_trade(
    database: Session, trade_id: int, trade_data: schemas.TradeClose
) -> models.Trade:
    trade = get_trade(database, trade_id)
    _require_status(trade, "open", "closed")
    trade.exit_price = trade_data.exit_price
    trade.exit_reason = trade_data.exit_reason
    if trade.position_size is None:
        trade.final_r = calculate_final_r(trade, trade_data.exit_price)
        remaining_quantity = None
    else:
        exited = sum((_quantity(item.quantity or 0) for item in trade.executions), Decimal("0.00"))
        remaining_quantity = float(_quantity(trade.position_size) - exited)
    final_execution = models.TradeExecution(
            trade=trade,
            execution_type="final",
            price=trade_data.exit_price,
            quantity=remaining_quantity,
            exit_reason=trade_data.exit_reason,
        )
    database.add(final_execution)
    database.flush()
    if trade.position_size is not None:
        trade.final_r = _weighted_execution_r(trade, list(trade.executions))
    trade.status = "closed"
    trade.closed_at = models.utc_now()
    trade.runner_active = False
    append_event(
        database, "trade_manually_closed", trade_id=trade.id,
        event_data={"exit_reason": trade_data.exit_reason, "final_r": trade.final_r},
    )
    database.commit()
    database.refresh(trade)
    return trade


def cancel_trade(database: Session, trade_id: int) -> models.Trade:
    trade = get_trade(database, trade_id)
    _require_status(trade, "planned", "cancelled")
    trade.status = "cancelled"
    database.commit()
    database.refresh(trade)
    return trade


def delete_trade(database: Session, trade_id: int) -> None:
    """Delete one trade and all records owned by it."""

    trade = get_trade(database, trade_id)
    database.delete(trade)
    database.commit()


def save_checklist_answers(
    database: Session, trade_id: int, answers: dict[str, bool]
) -> models.Trade:
    trade = get_trade(database, trade_id)
    _require_status(trade, "planned", "given checklist answers")
    existing = {answer.question_key: answer for answer in trade.checklist_answers}
    for question_key, value in answers.items():
        if question_key in existing:
            existing[question_key].answer = value
        else:
            database.add(
                models.ChecklistAnswer(
                    trade_id=trade.id,
                    question_key=question_key,
                    answer=value,
                )
            )
    database.commit()
    database.refresh(trade)
    return trade
