"""Trade persistence and lifecycle operations."""

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.errors import APIError
from app.services.option_contract_service import (
    build_option_contract,
    resolved_underlying_direction,
    underlying_direction,
)
from app.services.position_accounting_service import (
    aggregate_underlying_r,
    decimal_value,
    normalized_quantity,
    position_summary,
)
from app.services.workflow_event_service import append_event
from app.services.price_action_taxonomy import add_legacy_mirrors

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

    values = add_legacy_mirrors(trade_data.model_dump())
    trade = models.Trade(**_apply_option_contract(values), status="planned")
    database.add(trade)
    database.flush()
    append_event(
        database, "plan_created", trade_id=trade.id,
        event_data={"market": trade.market, "horizon": trade.trade_horizon, "setup": trade.setup,
                    "market_state": trade.market_state, "trade_thesis": trade.trade_thesis,
                    "entry_trigger": trade.entry_trigger, "location_tags": trade.location_tags,
                    "location_decision": trade.location_decision,
                    "reversal_confirmation": trade.reversal_confirmation},
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
    market_state: str | None = None,
    trade_thesis: str | None = None,
    entry_trigger: str | None = None,
    location_tag: str | None = None,
) -> list[models.Trade]:
    statement = select(models.Trade).options(
        selectinload(models.Trade.review),
        selectinload(models.Trade.executions),
        selectinload(models.Trade.entry_executions),
    )
    if trade_status is not None:
        statement = statement.where(models.Trade.status == trade_status)
    if trade_horizon is not None:
        statement = statement.where(models.Trade.trade_horizon == trade_horizon)
    if market_state is not None:
        statement = statement.where(models.Trade.market_state == market_state)
    if trade_thesis is not None:
        statement = statement.where(models.Trade.trade_thesis == trade_thesis)
    if entry_trigger is not None:
        statement = statement.where(models.Trade.entry_trigger == entry_trigger)
    if location_tag is not None:
        locations = func.json_each(models.Trade.location_tags).table_valued("key", "value")
        statement = statement.where(exists(select(1).select_from(locations).where(locations.c.value == location_tag)))
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
    if "trade_horizon" in updates:
        raise APIError(
            422,
            "DEDICATED_HORIZON_ENDPOINT_REQUIRED",
            "Use the dedicated horizon-change endpoint to update trade horizon.",
            {"trade_id": trade.id},
        )
    if trade.status == "planned":
        legacy_updates = set(updates) & {"setup", "market_context"}
        if legacy_updates and all(
            (trade.market_state, trade.trade_thesis, trade.entry_trigger)
        ):
            raise APIError(
                409,
                "LEGACY_CLASSIFICATION_READ_ONLY",
                "Legacy setup and market_context are read-only mirrors; patch the structured classification fields.",
                {"trade_id": trade.id, "fields": sorted(legacy_updates)},
            )
        prospective = {field: getattr(trade, field) for field in (
            "symbol", "market", "option_contract", "option_type", "option_expiration", "option_strike", "option_entry_price"
        )}
        prospective.update(updates)
        updates.update(_apply_option_contract(prospective))
        if set(updates) & {"market_state", "trade_thesis"}:
            merged_classification = {
                "market_state": updates.get("market_state", trade.market_state),
                "trade_thesis": updates.get("trade_thesis", trade.trade_thesis),
            }
            updates.update(add_legacy_mirrors(merged_classification))
        classification_fields = {
            "market_state", "trade_thesis", "entry_trigger", "location_tags",
            "location_decision", "reversal_confirmation",
        }
        if set(updates) & classification_fields:
            thesis = updates.get("trade_thesis", trade.trade_thesis)
            location_tags = updates.get("location_tags", trade.location_tags)
            location_decision = updates.get("location_decision", trade.location_decision)
            reversal_confirmation = updates.get(
                "reversal_confirmation", trade.reversal_confirmation
            )
            if location_decision == "selected" and not location_tags:
                raise APIError(422, "INVALID_LOCATION_DECISION", "Selected key locations require at least one location tag.", {})
            if location_decision == "none" and location_tags:
                raise APIError(422, "INVALID_LOCATION_DECISION", "No key location requires an empty location tag list.", {})
            if thesis == "major_reversal" and reversal_confirmation is None:
                raise APIError(422, "REVERSAL_CONFIRMATION_REQUIRED", "Major reversals require explicit confirmation.", {})
            if thesis != "major_reversal":
                updates["reversal_confirmation"] = None
                updates["is_unconfirmed_reversal"] = False
            elif "reversal_confirmation" in updates:
                updates["is_unconfirmed_reversal"] = reversal_confirmation == "unconfirmed"
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
    if (
        trade.status == "open"
        and "position_size" in updates
        and trade.entry_executions
    ):
        raise APIError(
            409,
            "INITIAL_QUANTITY_IMMUTABLE",
            "Initial quantity cannot be changed after entry is recorded; use Add Position.",
            {"trade_id": trade.id},
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
        event_data={
            "fields": sorted(updates),
            **({"runner_active": updates["runner_active"]} if "runner_active" in updates else {}),
        },
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

    if trade.entry_executions:
        return aggregate_underlying_r(trade, exit_price)
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
    if trade.entry_executions:
        return aggregate_underlying_r(trade)
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
    summary = position_summary(trade)
    if summary.total_entry_quantity <= 0:
        raise APIError(
            422,
            "POSITION_SIZE_REQUIRED",
            "Position size is required before recording a partial exit.",
            {"trade_id": trade.id},
        )
    exited_quantity = summary.total_exit_quantity
    position_size = summary.total_entry_quantity
    requested = _quantity(exit_data.quantity)
    remaining = summary.remaining_quantity
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
    if any(item.entry_kind == "initial" for item in trade.entry_executions):
        raise APIError(
            409,
            "DUPLICATE_INITIAL_ENTRY",
            "This trade already has an initial entry execution.",
            {"trade_id": trade.id},
        )
    if trade.position_size is None:
        raise APIError(
            422,
            "POSITION_SIZE_REQUIRED",
            "Position size is required before marking entry filled.",
            {"trade_id": trade.id},
        )
    database.add(
        models.TradeEntryExecution(
            trade=trade,
            executed_at=trade.opened_at,
            entry_kind="initial",
            underlying_price=decimal_value(trade.actual_entry),
            quantity=normalized_quantity(trade.position_size),
            stop_at_entry=decimal_value(trade.stop_loss),
            option_price=(
                decimal_value(trade.option_entry_price)
                if trade.market == "options" and trade.option_entry_price is not None
                else None
            ),
            reason="initial_plan",
        )
    )
    database.flush()
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
    summary = position_summary(trade)
    if summary.total_entry_quantity <= 0:
        trade.final_r = calculate_final_r(trade, trade_data.exit_price)
        remaining_quantity = None
    else:
        if summary.remaining_quantity <= 0:
            raise APIError(
                409,
                "INVALID_EXECUTION_QUANTITY",
                "No position quantity remains to close.",
                {"trade_id": trade.id},
            )
        remaining_quantity = float(summary.remaining_quantity)
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


def change_trade_horizon(
    database: Session,
    trade_id: int,
    horizon_data: schemas.TradeHorizonChange,
) -> models.Trade:
    """Change the classification horizon without reopening plan-readiness gates."""

    trade = get_trade(database, trade_id)
    if trade.status not in {"planned", "open"}:
        raise APIError(
            409,
            "INVALID_TRADE_STATE",
            "Only planned or open trades can change horizon.",
            {"trade_id": trade.id, "current_status": trade.status},
        )
    old_horizon = trade.trade_horizon
    new_horizon = horizon_data.trade_horizon
    if old_horizon == new_horizon:
        return trade
    changed_at = models.utc_now()
    trade.trade_horizon = new_horizon
    append_event(
        database,
        "trade_horizon_changed",
        trade_id=trade.id,
        event_data={
            "old_horizon": old_horizon,
            "new_horizon": new_horizon,
            "trade_status": trade.status,
            "changed_at": changed_at.isoformat(),
        },
    )
    database.commit()
    database.refresh(trade)
    return trade


def add_position_entry(
    database: Session,
    trade_id: int,
    entry_data: schemas.TradeEntryExecutionCreate,
) -> models.Trade:
    """Persist one local add execution after applying action-specific gates."""

    trade = get_trade(database, trade_id)
    _require_status(trade, "open", "added to")
    if trade.current_stop is None:
        raise APIError(
            409,
            "CURRENT_STOP_REQUIRED",
            "A current stop is required before adding to the position.",
            {"trade_id": trade.id},
        )
    if (
        trade.reversal_confirmation == "unconfirmed"
        or trade.is_unconfirmed_reversal
    ):
        append_event(
            database,
            "position_add_blocked",
            trade_id=trade.id,
            event_data={"reason": "unconfirmed_reversal"},
        )
        database.commit()
        raise APIError(
            409,
            "UNCONFIRMED_REVERSAL_ADD_BLOCKED",
            "Do not add to an unconfirmed reversal attempt.",
            {
                "trade_id": trade.id,
                "required_action": (
                    "Wait for confirmation or manage the existing position "
                    "without increasing exposure."
                ),
            },
        )

    direction = underlying_direction(
        trade.market, trade.direction, trade.option_type
    )
    valid_risk = (
        entry_data.stop_at_entry < entry_data.underlying_price
        if direction == "long"
        else entry_data.stop_at_entry > entry_data.underlying_price
    )
    if not valid_risk:
        raise APIError(
            422,
            "INVALID_ADD_RISK",
            "Stop at add must define positive risk in the underlying direction.",
            {
                "trade_id": trade.id,
                "direction": direction,
                "underlying_price": entry_data.underlying_price,
                "stop_at_entry": entry_data.stop_at_entry,
            },
        )

    old_summary = position_summary(trade)
    if not old_summary.accounting_consistent:
        raise APIError(
            409,
            "POSITION_ACCOUNTING_INCONSISTENT",
            "Repair entry and exit quantity history before adding exposure.",
            {"trade_id": trade.id},
        )
    current_r = (
        calculate_final_r(trade, trade.current_price)
        if trade.current_price is not None
        else None
    )
    warning_code = "adding_while_losing"
    if current_r is not None and current_r < 0 and warning_code not in set(
        entry_data.warnings_acknowledged
    ):
        raise APIError(
            409,
            "WARNING_ACKNOWLEDGEMENT_REQUIRED",
            "You are adding while the position is below its aggregate entry basis.",
            {
                "trade_id": trade.id,
                "warning_code": warning_code,
                "required_actions": [
                    "Confirm this is a planned add rather than emotional averaging.",
                    "Verify the structural stop.",
                    "Review new total risk.",
                ],
            },
        )

    old_current_stop = trade.current_stop
    execution = models.TradeEntryExecution(
        trade=trade,
        entry_kind="add",
        underlying_price=decimal_value(entry_data.underlying_price),
        quantity=normalized_quantity(entry_data.quantity),
        stop_at_entry=decimal_value(entry_data.stop_at_entry),
        option_price=(
            decimal_value(entry_data.option_price)
            if trade.market == "options" and entry_data.option_price is not None
            else None
        ),
        reason=entry_data.reason,
        notes=entry_data.notes,
    )
    database.add(execution)
    trade.current_stop = decimal_value(entry_data.stop_at_entry)
    database.flush()
    new_summary = position_summary(trade)
    incremental_risk = (
        abs(
            decimal_value(entry_data.underlying_price)
            - decimal_value(entry_data.stop_at_entry)
        )
        * normalized_quantity(entry_data.quantity)
    )
    append_event(
        database,
        "position_added",
        trade_id=trade.id,
        event_data={
            "entry_execution_id": execution.id,
            "quantity": float(normalized_quantity(entry_data.quantity)),
            "underlying_price": entry_data.underlying_price,
            "stop_at_entry": entry_data.stop_at_entry,
            "old_current_stop": (
                float(old_current_stop) if old_current_stop is not None else None
            ),
            "new_current_stop": entry_data.stop_at_entry,
            "reason": entry_data.reason,
            "old_total_entry_quantity": float(old_summary.total_entry_quantity),
            "new_total_entry_quantity": float(new_summary.total_entry_quantity),
            "old_average_entry": (
                float(old_summary.weighted_average_entry)
                if old_summary.weighted_average_entry is not None
                else None
            ),
            "new_average_entry": (
                float(new_summary.weighted_average_entry)
                if new_summary.weighted_average_entry is not None
                else None
            ),
            "incremental_risk": float(incremental_risk),
            "new_total_risk": float(new_summary.total_underlying_risk),
            "added_while_negative": bool(current_r is not None and current_r < 0),
        },
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
