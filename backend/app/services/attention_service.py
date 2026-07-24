"""Normalize active operational work into a single Attention Center feed."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app import models
from app.errors import APIError
from app.services.email_sender import EmailSettings
from app.services.price_alert_monitor import runtime_state
from app.services.rule_engine import evaluate_trade, rule_occurrence_token, rule_warning_identity
from app.services.trade_service import calculate_final_r, list_trades
from app.services.position_accounting_service import position_summary

SEVERITY_PRIORITY = {"blocker": 0, "warning": 1, "reminder": 2}


def _aware(value: datetime | None) -> datetime:
    if value is None:
        return models.utc_now()
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _trade_values(trade: models.Trade) -> dict[str, Any]:
    return {column.key: getattr(trade, column.key) for column in inspect(models.Trade).mapper.column_attrs}


def _item(
    *, item_id: str, source_type: str, severity: str, title: str, message: str,
    required_action: str, detected_at: datetime, destination_page: str,
    trade: models.Trade | None = None, current_r: float | None = None,
    destination_context: dict[str, str] | None = None, time_sensitive: bool = False,
    dismissible: bool = False, dismissal_key: str | None = None,
    occurrence_key: str | None = None, source_id: str | None = None,
    rule_id: str | None = None,
) -> dict[str, Any]:
    return {
        "id": item_id, "source_type": source_type, "severity": severity,
        "title": title, "message": message, "required_action": required_action,
        "trade_id": trade.id if trade else None, "symbol": trade.symbol if trade else None,
        "trade_horizon": trade.trade_horizon if trade else None, "current_r": current_r,
        "detected_at": _aware(detected_at), "destination_page": destination_page,
        "destination_context": destination_context or {}, "time_sensitive": time_sensitive,
        "dismissible": dismissible, "dismissal_key": dismissal_key,
        "occurrence_key": occurrence_key, "source_id": source_id, "rule_id": rule_id,
    }


def _source_for_rule(rule_id: str) -> str:
    return {
        "runner_must_have_protection": "runner_unprotected",
        "take_profit_and_let_runner_run": "profit_milestone",
        "green_trade_should_not_go_red": "green_to_red",
    }.get(rule_id, "trade_rule")


def _fingerprint(prefix: str, facts: dict[str, Any]) -> tuple[str, str]:
    digest = hashlib.sha256(
        json.dumps(facts, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()[:32]
    return f"warning:{prefix}:{digest}", f"occurrence:{prefix}:{digest}"


def build_attention_items(
    database: Session, horizon: str | None = None, *, include_dismissed: bool = False
) -> list[dict[str, Any]]:
    now = models.utc_now()
    items: list[dict[str, Any]] = []
    open_trades = list_trades(database, "open", horizon, 500, 0)
    for trade in open_trades:
        summary = position_summary(trade)
        try:
            current_r = calculate_final_r(trade, trade.current_price) if trade.current_price is not None else None
        except APIError:
            current_r = None
        if not summary.accounting_consistent:
            items.append(_item(item_id=f"trade:{trade.id}:accounting", source_type="accounting_inconsistency", severity="blocker", title=f"{trade.symbol}: position accounting inconsistent", message="Entry and exit quantities do not reconcile.", required_action="Repair execution history before recording another position change.", detected_at=trade.updated_at, destination_page="open-trades", trade=trade, current_r=current_r, destination_context={"trade_id": str(trade.id)}, time_sensitive=True))
        elif summary.uses_legacy_fallback and trade.position_size is not None:
            items.append(_item(item_id=f"trade:{trade.id}:legacy-accounting", source_type="incomplete_position_accounting", severity="warning", title=f"{trade.symbol}: entry history requires repair", message="This legacy open trade has no initial entry execution.", required_action="Backfill or repair the initial entry before adding exposure.", detected_at=trade.updated_at, destination_page="open-trades", trade=trade, current_r=current_r, destination_context={"trade_id": str(trade.id)}, dismissible=True, dismissal_key=f"warning:legacy-accounting:{trade.id}", occurrence_key=f"occurrence:legacy-accounting:{trade.id}", source_id=str(trade.id)))
        if trade.position_size is None:
            items.append(_item(item_id=f"trade:{trade.id}:position-size", source_type="missing_position_size", severity="blocker", title=f"{trade.symbol}: position size missing", message="Total position risk cannot be managed without position size.", required_action="Set position size.", detected_at=trade.updated_at, destination_page="open-trades", trade=trade, current_r=current_r, destination_context={"trade_id": str(trade.id)}, time_sensitive=True))
        if trade.current_stop is None:
            items.append(_item(item_id=f"trade:{trade.id}:current-stop", source_type="missing_stop", severity="blocker", title=f"{trade.symbol}: current stop missing", message="The open trade has no recorded active stop.", required_action="Set the current stop.", detected_at=trade.updated_at, destination_page="open-trades", trade=trade, current_r=current_r, destination_context={"trade_id": str(trade.id)}, time_sensitive=True))

        trade_values = _trade_values(trade) | {"current_r": current_r}
        result = evaluate_trade(trade_values)
        for alert in result["alerts"]:
            action = (alert.get("ui_hints") or {}).get("required_action") or (alert.get("next_actions") or [alert["message"]])[0]
            source = _source_for_rule(alert["rule_id"])
            dismissible = alert["severity"] == "warning"
            dismissal_key = occurrence_key = None
            if dismissible:
                dismissal_key, occurrence_key = rule_warning_identity(
                    trade_values, alert["rule_id"], trade_id=trade.id,
                    occurrence_token=rule_occurrence_token(trade, alert["rule_id"]),
                )
            items.append(_item(item_id=f"trade:{trade.id}:rule:{alert['rule_id']}", source_type=source, severity=alert["severity"], title=f"{trade.symbol}: action required", message=alert["message"], required_action=action, detected_at=trade.updated_at, destination_page="open-trades", trade=trade, current_r=current_r, destination_context={"trade_id": str(trade.id)}, time_sensitive=source in {"runner_unprotected", "profit_milestone", "green_to_red"}, dismissible=dismissible, dismissal_key=dismissal_key, occurrence_key=occurrence_key, source_id=f"trade:{trade.id}:rule:{alert['rule_id']}", rule_id=alert["rule_id"]))

    failed_events = database.scalars(select(models.TradePriceAlertEvent).where(models.TradePriceAlertEvent.notification_status == "failed").order_by(models.TradePriceAlertEvent.updated_at.desc()))
    for event in failed_events:
        trade = event.trade
        if horizon and trade.trade_horizon != horizon:
            continue
        dismissal_key = f"warning:failed-email:{event.id}"
        occurrence_key = f"occurrence:failed-email:{event.id}"
        items.append(_item(item_id=f"email-event:{event.id}", source_type="failed_email", severity="warning", title=f"{trade.symbol}: alert email failed", message=event.last_error or "A threshold alert email could not be sent.", required_action="Review email configuration and the triggered price alert.", detected_at=event.updated_at, destination_page="open-trades", trade=trade, destination_context={"trade_id": str(trade.id), "section": "price-alerts"}, time_sensitive=True, dismissible=True, dismissal_key=dismissal_key, occurrence_key=occurrence_key, source_id=str(event.id)))

    closed_trades = list_trades(database, "closed", horizon, 500, 0)
    for trade in closed_trades:
        if not trade.has_review:
            items.append(_item(item_id=f"trade:{trade.id}:pending-review", source_type="pending_review", severity="reminder", title=f"Review closed {trade.symbol} trade", message="This closed trade has not been reviewed.", required_action="Complete the post-trade review.", detected_at=trade.closed_at or trade.updated_at, destination_page="post-trade-review", trade=trade, current_r=trade.final_r, destination_context={"trade_id": str(trade.id)}))

    if horizon is None:
        settings = EmailSettings.from_env()
        monitor_configured = os.getenv("PRICE_ALERT_MONITOR_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
        if settings.enabled:
            facts = {
                "recipient_configured": bool(settings.recipient),
                "smtp_configured": settings.smtp_configured,
                "monitor_configured": monitor_configured,
                "monitor_running": runtime_state.running,
            }
            if not all((facts["recipient_configured"], facts["smtp_configured"], facts["monitor_configured"])):
                message = "Email alerts are enabled, but their configuration is incomplete."
            elif not runtime_state.running:
                message = "The configured price-alert monitor is unexpectedly not running."
            else:
                message = ""
            if message:
                dismissal_key, occurrence_key = _fingerprint("notification-configuration", facts)
                items.append(_item(item_id="notification:configuration", source_type="notification_configuration", severity="warning", title="Price alerts are not fully active", message=message, required_action="Review notification configuration.", detected_at=runtime_state.last_monitor_cycle_at or now, destination_page="dashboard", destination_context={"focus": "notifications"}, time_sensitive=True, dismissible=True, dismissal_key=dismissal_key, occurrence_key=occurrence_key, source_id="notification:configuration"))

    if not include_dismissed:
        dismissed_keys = set(database.scalars(select(models.WarningDismissal.dismissal_key)))
        items = [
            item for item in items
            if not item["dismissible"] or item["dismissal_key"] not in dismissed_keys
        ]

    items.sort(key=lambda item: (SEVERITY_PRIORITY[item["severity"]], not item["time_sensitive"], -item["detected_at"].timestamp(), item["id"]))
    return items
