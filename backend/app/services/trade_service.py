"""Trade persistence and lifecycle operations."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.errors import APIError


def create_planned_trade(database: Session, trade_data: schemas.TradeCreate) -> models.Trade:
    """Persist a new trade plan in the initial planned state."""

    trade = models.Trade(**trade_data.model_dump(), status="planned")
    database.add(trade)
    database.commit()
    database.refresh(trade)
    return trade


def list_trades(
    database: Session,
    trade_status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[models.Trade]:
    statement = select(models.Trade).options(
        selectinload(models.Trade.review),
        selectinload(models.Trade.executions),
    )
    if trade_status is not None:
        statement = statement.where(models.Trade.status == trade_status)
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
    management_fields = {
        "current_stop",
        "current_price",
        "runner_enabled",
        "runner_active",
        "runner_stop",
        "partial_taken",
        "partial_exit_quantity",
        "position_size",
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

    for field, value in updates.items():
        setattr(trade, field, value)
    database.commit()
    database.refresh(trade)
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
    initial_risk = (
        entry_price - trade.stop_loss
        if trade.direction == "long"
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
        if trade.direction == "long"
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


def _weighted_final_r(trade: models.Trade, final_price: float) -> float:
    partials = [item for item in trade.executions if item.execution_type == "partial"]
    if trade.position_size is None:
        if partials:
            raise APIError(
                422,
                "POSITION_SIZE_REQUIRED",
                "Position size is required to calculate weighted R after partial exits.",
                {"trade_id": trade.id},
            )
        return calculate_final_r(trade, final_price)

    partial_quantity = sum(item.quantity or 0.0 for item in partials)
    remaining_quantity = trade.position_size - partial_quantity
    if remaining_quantity < 0:
        raise APIError(
            409,
            "INVALID_EXECUTION_QUANTITY",
            "Recorded exits exceed the initial position size.",
            {"trade_id": trade.id},
        )
    weighted_r = sum(
        calculate_final_r(trade, item.price) * (item.quantity or 0.0)
        for item in partials
    )
    weighted_r += calculate_final_r(trade, final_price) * remaining_quantity
    return round(weighted_r / trade.position_size, 4)


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
    exited_quantity = sum(item.quantity or 0.0 for item in trade.executions)
    if exited_quantity + exit_data.quantity >= trade.position_size:
        raise APIError(
            422,
            "INVALID_PARTIAL_QUANTITY",
            "A partial exit must leave a positive quantity for the final exit.",
            {
                "position_size": trade.position_size,
                "already_exited": exited_quantity,
                "requested_quantity": exit_data.quantity,
            },
        )
    database.add(
        models.TradeExecution(
            trade=trade,
            execution_type="partial",
            price=exit_data.price,
            quantity=exit_data.quantity,
        )
    )
    trade.partial_exit_quantity = exited_quantity + exit_data.quantity
    trade.partial_taken = True
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
    _validate_price_structure(
        trade.direction, trade.actual_entry, trade.stop_loss, trade.target_1
    )
    trade.current_stop = trade.stop_loss
    trade.status = "open"
    trade.opened_at = models.utc_now()
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
    trade.final_r = _weighted_final_r(trade, trade_data.exit_price)
    trade.status = "closed"
    trade.closed_at = models.utc_now()
    trade.runner_active = False
    remaining_quantity = (
        None
        if trade.position_size is None
        else trade.position_size
        - sum(
            item.quantity or 0.0
            for item in trade.executions
            if item.execution_type == "partial"
        )
    )
    database.add(
        models.TradeExecution(
            trade=trade,
            execution_type="final",
            price=trade_data.exit_price,
            quantity=remaining_quantity,
        )
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
