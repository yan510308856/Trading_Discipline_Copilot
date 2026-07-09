"""Daily intraday readiness checklist business logic."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.errors import APIError


READINESS_TEMPLATE: list[dict[str, Any]] = [
    {
        "id": "watchlist_selected",
        "label": "Select today's watchlist before the open",
        "required": True,
        "category": "pre_market",
        "notes_placeholder": "Symbols I am watching today and why...",
    },
    {
        "id": "market_environment_assessed",
        "label": "Assess today's market environment",
        "required": True,
        "category": "market_context",
        "notes_placeholder": (
            "Trend, trading range, gap day, breakout mode, event-driven, uncertain..."
        ),
    },
    {
        "id": "important_events_checked",
        "label": "Check important events and scheduled risks",
        "required": True,
        "category": "scheduled_risk",
        "notes_placeholder": (
            "FOMC, CPI, PPI, NFP, Fed speakers, earnings, OPEC, bond auction, "
            "market holiday..."
        ),
    },
    {
        "id": "swing_positions_reviewed",
        "label": "Review existing swing positions",
        "required": True,
        "category": "position_review",
        "notes_placeholder": (
            "Do any swing positions need stop updates, profit taking, or no action?"
        ),
    },
    {
        "id": "daily_risk_limits_set",
        "label": "Define today's risk limits",
        "required": True,
        "category": "risk_limits",
        "notes_placeholder": (
            "Max daily loss, max number of trades, stop-after-loss rule, "
            "max revenge-trade risk..."
        ),
    },
    {
        "id": "platform_ready",
        "label": "Confirm platform, data, and broker access are working",
        "required": False,
        "category": "operations",
        "notes_placeholder": "",
    },
    {
        "id": "mental_state_checked",
        "label": "Check mental and physical state",
        "required": False,
        "category": "self_check",
        "notes_placeholder": "",
    },
    {
        "id": "no_forced_trade_confirmed",
        "label": "Confirm there is no need to force a trade today",
        "required": False,
        "category": "discipline",
        "notes_placeholder": "",
    },
]


def _default_items() -> list[dict[str, Any]]:
    return [
        {
            **item,
            "completed": False,
            "notes": "",
        }
        for item in READINESS_TEMPLATE
    ]


def _template_by_id() -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in READINESS_TEMPLATE}


def _merge_items(saved_items: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    saved_by_id = {item.get("id"): item for item in saved_items or []}
    merged = []
    for template_item in READINESS_TEMPLATE:
        saved_item = saved_by_id.get(template_item["id"], {})
        merged.append(
            {
                **template_item,
                "completed": bool(saved_item.get("completed", False)),
                "notes": str(saved_item.get("notes", "")),
            }
        )
    return merged


def _counts(items: list[dict[str, Any]]) -> tuple[int, int]:
    required_items = [item for item in items if item["required"]]
    completed = sum(1 for item in required_items if item["completed"])
    return completed, len(required_items)


def _status(completed: int, total: int) -> schemas.ReadinessStatus:
    if completed == total:
        return "cleared"
    if completed == 0:
        return "not_cleared"
    return "partially_ready"


def _serialize(record: models.DailyReadiness) -> schemas.DailyReadinessRead:
    items = _merge_items(record.checklist_items)
    completed, total = _counts(items)
    status = _status(completed, total)
    return schemas.DailyReadinessRead(
        id=record.id,
        readiness_date=record.readiness_date,
        created_at=record.created_at,
        updated_at=record.updated_at,
        items=items,
        notes=record.notes,
        required_complete_count=completed,
        required_total_count=total,
        is_cleared_for_intraday=status == "cleared",
        status=status,
    )


def _apply_computed_fields(record: models.DailyReadiness) -> None:
    items = _merge_items(record.checklist_items)
    completed, total = _counts(items)
    record.checklist_items = items
    record.completed_required_count = completed
    record.total_required_count = total
    record.is_cleared_for_intraday = completed == total


def _new_record(readiness_date: date) -> models.DailyReadiness:
    items = _default_items()
    completed, total = _counts(items)
    return models.DailyReadiness(
        readiness_date=readiness_date,
        checklist_items=items,
        notes=None,
        completed_required_count=completed,
        total_required_count=total,
        is_cleared_for_intraday=False,
    )


def get_readiness(database: Session, readiness_date: date) -> schemas.DailyReadinessRead:
    statement = select(models.DailyReadiness).where(
        models.DailyReadiness.readiness_date == readiness_date
    )
    record = database.scalar(statement)
    if record is None:
        record = _new_record(readiness_date)
        database.add(record)
        database.commit()
        database.refresh(record)
    return _serialize(record)


def update_readiness(
    database: Session,
    readiness_date: date,
    update: schemas.DailyReadinessUpdate,
) -> schemas.DailyReadinessRead:
    template_by_id = _template_by_id()
    unknown_ids = sorted({item.id for item in update.items} - set(template_by_id))
    if unknown_ids:
        raise APIError(
            422,
            "UNKNOWN_READINESS_ITEM",
            "Daily readiness contains unknown checklist item IDs.",
            {"item_ids": unknown_ids},
        )

    statement = select(models.DailyReadiness).where(
        models.DailyReadiness.readiness_date == readiness_date
    )
    record = database.scalar(statement)
    if record is None:
        record = _new_record(readiness_date)
        database.add(record)

    updates_by_id = {item.id: item for item in update.items}
    merged_items = []
    for current_item in _merge_items(record.checklist_items):
        item_update = updates_by_id.get(current_item["id"])
        if item_update is None:
            merged_items.append(current_item)
            continue
        merged_items.append(
            {
                **current_item,
                "completed": item_update.completed,
                "notes": item_update.notes,
            }
        )

    record.checklist_items = merged_items
    record.notes = update.notes
    _apply_computed_fields(record)
    database.commit()
    database.refresh(record)
    return _serialize(record)
