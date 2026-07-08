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


def list_trades(database: Session) -> list[models.Trade]:
    statement = (
        select(models.Trade)
        .options(selectinload(models.Trade.review))
        .order_by(models.Trade.id.desc())
    )
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
    trade.final_r = calculate_final_r(trade, trade_data.exit_price)
    trade.status = "closed"
    trade.closed_at = models.utc_now()
    trade.runner_active = False
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
