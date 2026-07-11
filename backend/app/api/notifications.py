"""Non-secret notification configuration and alert history routes."""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.errors import APIError
from app.services import trade_service
from app.services.email_sender import EmailSettings, configured_email_sender, env_bool
from app.services.price_alert_monitor import runtime_state

router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.get("/notifications/status", response_model=schemas.NotificationStatus)
def notification_status(database: Database) -> dict[str, object]:
    settings = EmailSettings.from_env()
    sender = configured_email_sender(settings)
    latest_email = database.scalar(
        select(models.TradePriceAlertEvent)
        .order_by(models.TradePriceAlertEvent.updated_at.desc())
        .limit(1)
    )
    return {
        "email_enabled": settings.enabled,
        "recipient_configured": bool(settings.recipient),
        "smtp_configured": settings.smtp_configured,
        "monitor_configured": env_bool("PRICE_ALERT_MONITOR_ENABLED"),
        "monitor_running": runtime_state.running,
        "poll_seconds": max(5, int(os.getenv("PRICE_ALERT_POLL_SECONDS", "60"))),
        "provider_name": sender.provider_name,
        "last_monitor_cycle_at": runtime_state.last_monitor_cycle_at,
        "last_price_refresh_at": runtime_state.last_price_refresh_at,
        "last_monitor_error": runtime_state.last_monitor_error,
        "latest_email_status": latest_email.notification_status if latest_email else None,
        "latest_email_at": (
            latest_email.sent_at or latest_email.updated_at or latest_email.triggered_at
            if latest_email else None
        ),
    }


@router.get("/trades/{trade_id}/price-alert-events", response_model=list[schemas.TradePriceAlertEventRead])
def price_alert_events(trade_id: int, database: Database) -> list[models.TradePriceAlertEvent]:
    trade_service.get_trade(database, trade_id)
    return list(database.scalars(
        select(models.TradePriceAlertEvent)
        .where(models.TradePriceAlertEvent.trade_id == trade_id)
        .order_by(models.TradePriceAlertEvent.triggered_at.desc())
    ))


@router.post("/notifications/test-email")
def test_email() -> dict[str, str]:
    settings = EmailSettings.from_env()
    sender = configured_email_sender(settings)
    if sender.provider_name == "disabled":
        raise APIError(503, "EMAIL_NOT_CONFIGURED", "Email notifications are disabled or incomplete.")
    try:
        sender.send_test_email()
    except Exception as error:
        raise APIError(502, "EMAIL_SEND_FAILED", "The test email could not be sent.", {"error_type": type(error).__name__}) from error
    return {"status": "sent"}
