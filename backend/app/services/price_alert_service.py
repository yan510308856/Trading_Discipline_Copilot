"""Durable threshold detection and controlled email retries."""

from __future__ import annotations

import logging
import os
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.services.email_sender import DisabledEmailSender, EmailSender, configured_email_sender
from app.services.option_contract_service import resolved_underlying_direction
from app.services.workflow_event_service import append_event

logger = logging.getLogger(__name__)


def normalized_price(value: float) -> str:
    return str(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def reached(direction: str, kind: str, observed: float, threshold: float) -> bool:
    if kind == "stop":
        return observed <= threshold if direction == "long" else observed >= threshold
    return observed >= threshold if direction == "long" else observed <= threshold


def _existing(database: Session, key: str) -> models.TradePriceAlertEvent | None:
    return database.scalar(
        select(models.TradePriceAlertEvent).where(models.TradePriceAlertEvent.dedupe_key == key)
    )


def _create_event(
    database: Session, trade: models.Trade, kind: str, threshold: float, observed: float
) -> models.TradePriceAlertEvent:
    normalized = normalized_price(threshold)
    key = f"trade:{trade.id}:price:{normalized}"
    existing = _existing(database, key)
    if existing:
        logger.info("duplicate_alert_suppressed trade_id=%s dedupe_key=%s", trade.id, key)
        return existing
    event = models.TradePriceAlertEvent(
        trade_id=trade.id,
        alert_kind=kind,
        threshold_price=threshold,
        observed_price=observed,
        normalized_threshold_price=normalized,
        dedupe_key=key,
    )
    try:
        with database.begin_nested():
            database.add(event)
            database.flush()
    except IntegrityError:
        event = _existing(database, key)
        if event is None:
            raise
        logger.info("duplicate_alert_suppressed trade_id=%s dedupe_key=%s", trade.id, key)
        return event
    logger.info("alert_event_created trade_id=%s kind=%s threshold=%s", trade.id, kind, normalized)
    return event


def send_event(
    database: Session,
    trade: models.Trade,
    event: models.TradePriceAlertEvent,
    sender: EmailSender,
    retry_limit: int,
) -> None:
    if event.notification_status == "sent" or event.attempt_count >= retry_limit:
        return
    if isinstance(sender, DisabledEmailSender):
        return
    event.attempt_count += 1
    if event.attempt_count > 1:
        logger.info("email_retry_attempted trade_id=%s event_id=%s attempt=%s", trade.id, event.id, event.attempt_count)
    try:
        sender.send_price_alert(trade, event)
    except Exception as error:  # provider failures become durable state
        event.notification_status = "failed"
        event.last_error = str(error)[:1000]
        append_event(
            database, "notification_email_failed", trade_id=trade.id,
            severity="warning",
            idempotency_key=f"email:{event.id}:attempt:{event.attempt_count}:failed",
            event_data={"alert_kind": event.alert_kind, "attempt_count": event.attempt_count, "error_type": type(error).__name__},
        )
        logger.warning("email_failed trade_id=%s event_id=%s error_type=%s", trade.id, event.id, type(error).__name__)
    else:
        event.notification_status = "sent"
        event.sent_at = models.utc_now()
        event.last_error = None
        append_event(
            database, "notification_email_sent", trade_id=trade.id,
            idempotency_key=f"email:{event.id}:attempt:{event.attempt_count}:sent",
            event_data={"alert_kind": event.alert_kind, "attempt_count": event.attempt_count},
        )
        logger.info("email_sent trade_id=%s event_id=%s", trade.id, event.id)


def evaluate_trade_price_alerts(
    database: Session,
    trade: models.Trade,
    sender: EmailSender | None = None,
    retry_limit: int | None = None,
) -> list[models.TradePriceAlertEvent]:
    if trade.status != "open" or trade.current_price is None:
        return []
    sender = sender or configured_email_sender()
    retry_limit = retry_limit or max(1, int(os.getenv("PRICE_ALERT_RETRY_LIMIT", "3")))
    thresholds = [("target_1", trade.target_1)]
    if trade.target_2 is not None:
        thresholds.append(("target_2", trade.target_2))
    thresholds.append(("stop", trade.current_stop if trade.current_stop is not None else trade.stop_loss))
    events: list[models.TradePriceAlertEvent] = []
    for kind, threshold in thresholds:
        entry_price = trade.actual_entry if trade.actual_entry is not None else trade.planned_entry
        price_direction = resolved_underlying_direction(
            trade.market, trade.direction, trade.option_type, entry_price, trade.stop_loss
        )
        if reached(price_direction, kind, trade.current_price, threshold):
            logger.info("threshold_reached trade_id=%s kind=%s observed=%s", trade.id, kind, trade.current_price)
            event = _create_event(database, trade, kind, threshold, trade.current_price)
            send_event(database, trade, event, sender, retry_limit)
            if event not in events:
                events.append(event)
    database.commit()
    return events


def retry_unsent_events(database: Session, sender: EmailSender | None = None) -> None:
    sender = sender or configured_email_sender()
    limit = max(1, int(os.getenv("PRICE_ALERT_RETRY_LIMIT", "3")))
    events = database.scalars(
        select(models.TradePriceAlertEvent).where(
            models.TradePriceAlertEvent.notification_status.in_(["pending", "failed"]),
            models.TradePriceAlertEvent.attempt_count < limit,
        )
    )
    for event in events:
        send_event(database, event.trade, event, sender, limit)
    database.commit()
