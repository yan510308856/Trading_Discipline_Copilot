"""Small append-only workflow audit API."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models


def append_event(
    database: Session,
    event_type: str,
    *,
    trade_id: int | None = None,
    readiness_date: date | None = None,
    rule_id: str | None = None,
    severity: str | None = None,
    idempotency_key: str | None = None,
    event_data: dict[str, Any] | None = None,
    occurred_at: datetime | None = None,
) -> models.WorkflowEvent:
    if idempotency_key:
        existing = database.scalar(
            select(models.WorkflowEvent).where(
                models.WorkflowEvent.idempotency_key == idempotency_key
            )
        )
        if existing is not None:
            return existing
    event = models.WorkflowEvent(
        event_type=event_type,
        trade_id=trade_id,
        readiness_date=readiness_date,
        rule_id=rule_id,
        severity=severity,
        idempotency_key=idempotency_key,
        event_data=event_data or {},
        occurred_at=occurred_at or models.utc_now(),
    )
    database.add(event)
    return event
