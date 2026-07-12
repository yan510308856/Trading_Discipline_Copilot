"""Process-focused discipline effectiveness analytics."""

from __future__ import annotations

import os
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from statistics import median

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models
from app.services.option_contract_service import underlying_direction

HORIZONS = ("intraday", "swing", "leap", "other")


def _rate(numerator: int | float, denominator: int | float) -> float | None:
    return round(float(numerator) / float(denominator), 4) if denominator else None


def _average(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 4) if values else None


def _boundaries(date_from: date | None, date_to: date | None) -> tuple[datetime | None, datetime | None]:
    start = datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from else None
    end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc) if date_to else None
    return start, end


def _in_time(statement, column, start: datetime | None, end: datetime | None):
    if start is not None:
        statement = statement.where(column >= start)
    if end is not None:
        statement = statement.where(column < end)
    return statement


def _trade_filters(statement, horizon: str | None, market: str | None, setup: str | None):
    if horizon:
        statement = statement.where(models.Trade.trade_horizon == horizon)
    if market:
        statement = statement.where(models.Trade.market == market)
    if setup:
        statement = statement.where(models.Trade.setup == setup)
    return statement


def _event_matches(event: models.WorkflowEvent, horizon: str | None, market: str | None, setup: str | None) -> bool:
    data = event.event_data or {}
    trade = event.trade
    return all((expected is None or actual == expected) for expected, actual in (
        (horizon, data.get("horizon") if event.event_type.startswith("plan_") else getattr(trade, "trade_horizon", None)),
        (market, data.get("market") if event.event_type.startswith("plan_") else getattr(trade, "market", None)),
        (setup, data.get("setup") if event.event_type.startswith("plan_") else getattr(trade, "setup", None)),
    ))


def discipline_analytics(
    database: Session,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    trade_horizon: str | None = None,
    market: str | None = None,
    setup: str | None = None,
) -> dict:
    start, end = _boundaries(date_from, date_to)

    readiness_statement = select(models.DailyReadiness)
    if date_from:
        readiness_statement = readiness_statement.where(models.DailyReadiness.readiness_date >= date_from)
    if date_to:
        readiness_statement = readiness_statement.where(models.DailyReadiness.readiness_date <= date_to)
    readiness = list(database.scalars(readiness_statement))

    plans_statement = _trade_filters(select(models.Trade).options(
        selectinload(models.Trade.review), selectinload(models.Trade.executions),
        selectinload(models.Trade.alerts), selectinload(models.Trade.price_alert_events),
    ), trade_horizon, market, setup)
    plans_statement = _in_time(plans_statement, models.Trade.created_at, start, end)
    plans = list(database.scalars(plans_statement))

    opened_statement = _trade_filters(select(models.Trade).options(
        selectinload(models.Trade.executions), selectinload(models.Trade.alerts)
    ).where(models.Trade.opened_at.is_not(None)), trade_horizon, market, setup)
    opened_statement = _in_time(opened_statement, models.Trade.opened_at, start, end)
    opened = list(database.scalars(opened_statement))

    closed_statement = _trade_filters(select(models.Trade).options(
        selectinload(models.Trade.review), selectinload(models.Trade.executions)
    ).where(models.Trade.closed_at.is_not(None)), trade_horizon, market, setup)
    closed_statement = _in_time(closed_statement, models.Trade.closed_at, start, end)
    closed = list(database.scalars(closed_statement))

    event_statement = select(models.WorkflowEvent).options(selectinload(models.WorkflowEvent.trade))
    event_statement = _in_time(event_statement, models.WorkflowEvent.occurred_at, start, end)
    events = [event for event in database.scalars(event_statement) if _event_matches(event, trade_horizon, market, setup)]

    event_types = Counter(event.event_type for event in events)
    planned_rrs: list[float] = []
    total_risks: list[float] = []
    valid_stop_count = 0
    for trade in plans:
        direction = underlying_direction(trade.market, trade.direction, trade.option_type)
        risk = trade.planned_entry - trade.stop_loss if direction == "long" else trade.stop_loss - trade.planned_entry
        reward = trade.target_1 - trade.planned_entry if direction == "long" else trade.planned_entry - trade.target_1
        if risk > 0:
            valid_stop_count += 1
            if reward > 0:
                planned_rrs.append(reward / risk)
            if trade.position_size is not None and trade.position_size > 0:
                total_risks.append(risk * trade.position_size)

    reviewed = [trade for trade in closed if trade.review is not None]
    review_delays = [
        max(0.0, (trade.review.created_at - trade.closed_at).total_seconds() / 60)
        for trade in reviewed if trade.closed_at is not None
    ]
    within_24 = sum(delay <= 1440 for delay in review_delays)

    alert_statement = select(models.TradePriceAlertEvent).join(models.Trade)
    alert_statement = _trade_filters(alert_statement, trade_horizon, market, setup)
    alert_statement = _in_time(alert_statement, models.TradePriceAlertEvent.triggered_at, start, end)
    threshold_events = list(database.scalars(alert_statement))
    attempted_events = [event for event in threshold_events if event.attempt_count > 0]
    retry_limit = max(1, int(os.getenv("PRICE_ALERT_RETRY_LIMIT", "3")))
    failures = [event for event in threshold_events if event.notification_status == "failed"]

    mistake_counts: Counter[str] = Counter()
    horizon_issues: Counter[str] = Counter({horizon: 0 for horizon in HORIZONS})
    for trade in reviewed:
        mistake_counts.update(trade.review.mistake_tags)
        horizon_issues[trade.trade_horizon] += len(trade.review.mistake_tags)

    blocker_counts: Counter[str] = Counter()
    warning_counts: Counter[str] = Counter()
    for event in events:
        if event.event_type not in {"plan_blocked", "plan_warning_detected"}:
            continue
        rule_ids = event.event_data.get("rule_ids", [])
        target = blocker_counts if event.event_type == "plan_blocked" else warning_counts
        target.update(rule_ids)
        horizon = event.event_data.get("horizon")
        if horizon in HORIZONS:
            horizon_issues[horizon] += len(rule_ids)

    runner_alerts = sum(alert.rule_id == "runner_must_have_protection" for trade in opened for alert in trade.alerts)
    green_alerts = sum(alert.rule_id == "green_trade_should_not_go_red" for trade in opened for alert in trade.alerts)
    for trade in opened:
        horizon_issues[trade.trade_horizon] += sum(alert.rule_id in {"runner_must_have_protection", "green_trade_should_not_go_red"} for alert in trade.alerts)

    runner_trade_ids = {
        event.trade_id for event in events
        if event.event_type == "trade_updated" and event.event_data.get("runner_active") is True and event.trade_id is not None
    }
    partial_trade_count = sum(any(execution.execution_type == "partial" for execution in trade.executions) for trade in opened)
    execution_count = sum(len(trade.executions) for trade in opened)
    final_rs = [float(trade.final_r) for trade in closed if trade.final_r is not None]
    scores = [float(trade.discipline_score) for trade in reviewed if trade.discipline_score is not None]

    def frequencies(counter: Counter[str]) -> list[dict]:
        return [{"key": key, "count": count} for key, count in counter.most_common(10)]

    return {
        "timezone": "UTC", "date_from": date_from, "date_to": date_to,
        "trade_horizon": trade_horizon, "market": market, "setup": setup,
        "preparation": {
            "readiness_days_recorded": len(readiness),
            "readiness_days_cleared": sum(item.is_cleared_for_intraday for item in readiness),
            "readiness_completion_rate": _rate(sum(item.is_cleared_for_intraday for item in readiness), len(readiness)),
            "average_required_items_completed": _average([float(item.completed_required_count) for item in readiness]),
        },
        "planning_quality": {
            "plans_created": len(plans), "blocked_plan_attempts": event_types["plan_blocked"],
            "warning_finalization_attempts": event_types["plan_warning_detected"],
            "percent_plans_with_valid_stop": _rate(valid_stop_count, len(plans)),
            "percent_plans_with_position_size": _rate(sum(trade.position_size is not None and trade.position_size > 0 for trade in plans), len(plans)),
            "average_planned_risk_reward": _average(planned_rrs), "average_total_planned_risk": _average(total_risks),
        },
        "execution_discipline": {
            "trades_opened": len(opened), "trades_with_partial_exits": partial_trade_count,
            "partial_exit_rate": _rate(partial_trade_count, len(opened)),
            "trades_with_runner_activated": len(runner_trade_ids),
            "runner_without_stop_occurrences": runner_alerts,
            "green_to_red_warning_occurrences": green_alerts,
            "average_number_of_exit_executions": _rate(execution_count, len(opened)),
            "auto_closed_trade_count": event_types["trade_auto_closed"],
        },
        "review_completion": {
            "closed_trades": len(closed), "reviewed_trades": len(reviewed),
            "review_completion_rate": _rate(len(reviewed), len(closed)),
            "median_close_to_review_minutes": round(median(review_delays), 2) if review_delays else None,
            "reviews_within_24_hours": within_24,
            "review_within_24_hours_rate": _rate(within_24, len(review_delays)),
            "pending_review_count": len(closed) - len(reviewed),
        },
        "notification_reliability": {
            "threshold_events": len(threshold_events),
            "emails_sent": sum(event.notification_status == "sent" for event in threshold_events),
            "emails_failed": len(failures),
            "email_success_rate": _rate(sum(event.notification_status == "sent" for event in attempted_events), len(attempted_events)),
            "retry_exhausted_events": sum(event.notification_status != "sent" and event.attempt_count >= retry_limit for event in threshold_events),
            "latest_failure_at": max((event.updated_at for event in failures), default=None),
        },
        "recurring_issues": {
            "most_frequent_mistake_tags": frequencies(mistake_counts),
            "most_frequent_blocking_rules": frequencies(blocker_counts),
            "most_frequent_warning_rules": frequencies(warning_counts),
            "issue_breakdown_by_horizon": [{"horizon": horizon, "issue_count": horizon_issues[horizon]} for horizon in HORIZONS],
        },
        "outcome_context": {
            "total_underlying_r": round(sum(final_rs), 4),
            "average_underlying_r": _average(final_rs),
            "median_underlying_r": round(float(median(final_rs)), 4) if final_rs else None,
            "average_discipline_score": _average(scores),
        },
    }
