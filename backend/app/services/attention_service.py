"""Normalize active operational work into a single Attention Center feed."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app import models
from app.services.email_sender import EmailSettings
from app.services.price_alert_monitor import runtime_state
from app.services.rule_engine import evaluate_trade
from app.services.trade_service import calculate_final_r, list_trades

STALE_PRICE_SECONDS = 120
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
) -> dict[str, Any]:
    return {
        "id": item_id, "source_type": source_type, "severity": severity,
        "title": title, "message": message, "required_action": required_action,
        "trade_id": trade.id if trade else None, "symbol": trade.symbol if trade else None,
        "trade_horizon": trade.trade_horizon if trade else None, "current_r": current_r,
        "detected_at": _aware(detected_at), "destination_page": destination_page,
        "destination_context": destination_context or {}, "time_sensitive": time_sensitive,
    }


def _source_for_rule(rule_id: str) -> str:
    return {
        "runner_must_have_protection": "runner_unprotected",
        "take_profit_and_let_runner_run": "profit_milestone",
        "green_trade_should_not_go_red": "green_to_red",
    }.get(rule_id, "trade_rule")


def build_attention_items(database: Session, horizon: str | None = None) -> list[dict[str, Any]]:
    now = models.utc_now()
    items: list[dict[str, Any]] = []
    open_trades = list_trades(database, "open", horizon, 500, 0)
    for trade in open_trades:
        current_r = calculate_final_r(trade, trade.current_price) if trade.current_price is not None else None
        if trade.position_size is None:
            items.append(_item(item_id=f"trade:{trade.id}:position-size", source_type="missing_position_size", severity="blocker", title=f"{trade.symbol}: position size missing", message="Total position risk cannot be managed without position size.", required_action="Set position size.", detected_at=trade.updated_at, destination_page="open-trades", trade=trade, current_r=current_r, destination_context={"trade_id": str(trade.id)}, time_sensitive=True))
        if trade.current_stop is None:
            items.append(_item(item_id=f"trade:{trade.id}:current-stop", source_type="missing_stop", severity="blocker", title=f"{trade.symbol}: current stop missing", message="The open trade has no recorded active stop.", required_action="Set the current stop.", detected_at=trade.updated_at, destination_page="open-trades", trade=trade, current_r=current_r, destination_context={"trade_id": str(trade.id)}, time_sensitive=True))

        result = evaluate_trade(_trade_values(trade) | {"current_r": current_r})
        for alert in result["alerts"]:
            action = (alert.get("ui_hints") or {}).get("required_action") or (alert.get("next_actions") or [alert["message"]])[0]
            source = _source_for_rule(alert["rule_id"])
            items.append(_item(item_id=f"trade:{trade.id}:rule:{alert['rule_id']}", source_type=source, severity=alert["severity"], title=f"{trade.symbol}: action required", message=alert["message"], required_action=action, detected_at=trade.updated_at, destination_page="open-trades", trade=trade, current_r=current_r, destination_context={"trade_id": str(trade.id)}, time_sensitive=source in {"runner_unprotected", "profit_milestone", "green_to_red"}))

        updated_at = _aware(trade.current_price_updated_at) if trade.current_price_updated_at else None
        if updated_at and (now - updated_at).total_seconds() > STALE_PRICE_SECONDS:
            items.append(_item(item_id=f"trade:{trade.id}:stale-price", source_type="stale_price", severity="warning", title=f"{trade.symbol}: price is stale", message="The recorded current price is older than the operational freshness threshold.", required_action="Refresh or manually verify the current price.", detected_at=updated_at, destination_page="open-trades", trade=trade, current_r=current_r, destination_context={"trade_id": str(trade.id)}, time_sensitive=True))

    failed_events = database.scalars(select(models.TradePriceAlertEvent).where(models.TradePriceAlertEvent.notification_status == "failed").order_by(models.TradePriceAlertEvent.updated_at.desc()))
    for event in failed_events:
        trade = event.trade
        if horizon and trade.trade_horizon != horizon:
            continue
        items.append(_item(item_id=f"email-event:{event.id}", source_type="failed_email", severity="warning", title=f"{trade.symbol}: alert email failed", message=event.last_error or "A threshold alert email could not be sent.", required_action="Review email configuration and the triggered price alert.", detected_at=event.updated_at, destination_page="open-trades", trade=trade, destination_context={"trade_id": str(trade.id), "section": "price-alerts"}, time_sensitive=True))

    closed_trades = list_trades(database, "closed", horizon, 500, 0)
    for trade in closed_trades:
        if not trade.has_review:
            items.append(_item(item_id=f"trade:{trade.id}:pending-review", source_type="pending_review", severity="reminder", title=f"Review closed {trade.symbol} trade", message="This closed trade has not been reviewed.", required_action="Complete the post-trade review.", detected_at=trade.closed_at or trade.updated_at, destination_page="post-trade-review", trade=trade, current_r=trade.final_r, destination_context={"trade_id": str(trade.id)}))

    if horizon is None:
        settings = EmailSettings.from_env()
        monitor_configured = os.getenv("PRICE_ALERT_MONITOR_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
        configuration_ok = settings.enabled and bool(settings.recipient) and settings.smtp_configured and monitor_configured and runtime_state.running
        if not configuration_ok:
            items.append(_item(item_id="notification:configuration", source_type="notification_configuration", severity="warning", title="Price alerts are not fully active", message="Email or background-monitor configuration is incomplete.", required_action="Review notification configuration.", detected_at=runtime_state.last_monitor_cycle_at or now, destination_page="dashboard", destination_context={"focus": "notifications"}, time_sensitive=True))

    items.sort(key=lambda item: (SEVERITY_PRIORITY[item["severity"]], not item["time_sensitive"], -item["detected_at"].timestamp(), item["id"]))
    return items
