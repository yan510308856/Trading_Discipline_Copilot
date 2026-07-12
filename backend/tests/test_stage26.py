from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import models


NOW = datetime(2026, 7, 10, 15, 0, tzinfo=timezone.utc)


def trade(**updates) -> models.Trade:
    values = {
        "symbol": "SPY", "market": "stocks", "direction": "long",
        "setup": "breakout", "market_context": "strong_trend",
        "planned_entry": 100.0, "stop_loss": 95.0, "target_1": 110.0,
        "position_size": 4.0, "trade_horizon": "swing", "created_at": NOW,
    }
    values.update(updates)
    return models.Trade(**values)


def get(client: TestClient, query: str = "") -> dict:
    response = client.get(f"/analytics/discipline{query}")
    assert response.status_code == 200, response.text
    return response.json()


def test_readiness_rates_and_zero_denominators(api_client: TestClient, database_session: Session) -> None:
    empty = get(api_client)
    assert empty["preparation"]["readiness_completion_rate"] is None
    assert empty["review_completion"]["review_completion_rate"] is None
    assert empty["notification_reliability"]["email_success_rate"] is None

    database_session.add_all([
        models.DailyReadiness(readiness_date=date(2026, 7, 9), is_cleared_for_intraday=True, completed_required_count=5, total_required_count=5),
        models.DailyReadiness(readiness_date=date(2026, 7, 10), is_cleared_for_intraday=False, completed_required_count=3, total_required_count=5),
    ])
    database_session.commit()
    preparation = get(api_client)["preparation"]
    assert preparation == {
        "readiness_days_recorded": 2, "readiness_days_cleared": 1,
        "readiness_completion_rate": 0.5, "average_required_items_completed": 4.0,
    }


def test_planning_quality_and_workflow_attempts(api_client: TestClient, database_session: Session) -> None:
    database_session.add_all([
        trade(symbol="GOOD"),
        trade(symbol="BAD", stop_loss=105, position_size=None),
        models.WorkflowEvent(event_type="plan_blocked", occurred_at=NOW, event_data={"rule_ids": ["stop_required"], "horizon": "swing", "market": "stocks", "setup": "breakout"}),
        models.WorkflowEvent(event_type="plan_warning_detected", occurred_at=NOW, event_data={"rule_ids": ["late_entry"], "horizon": "swing", "market": "stocks", "setup": "breakout"}),
    ])
    database_session.commit()
    body = get(api_client)
    planning = body["planning_quality"]
    assert planning["blocked_plan_attempts"] == 1
    assert planning["warning_finalization_attempts"] == 1
    assert planning["percent_plans_with_valid_stop"] == 0.5
    assert planning["percent_plans_with_position_size"] == 0.5
    assert planning["average_planned_risk_reward"] == 2.0
    assert planning["average_total_planned_risk"] == 20.0
    assert body["recurring_issues"]["most_frequent_blocking_rules"] == [{"key": "stop_required", "count": 1}]


def test_execution_review_and_underlying_r_metrics(api_client: TestClient, database_session: Session) -> None:
    first = trade(status="closed", opened_at=NOW - timedelta(days=1), closed_at=NOW, final_r=2.0, discipline_score=90)
    option = trade(symbol="QQQ", market="options", option_type="put", direction="long", option_expiration=date(2026, 8, 21), option_strike=500, option_contract="QQQ 2026-08-21 500 Put", status="closed", opened_at=NOW - timedelta(hours=2), closed_at=NOW + timedelta(hours=1), final_r=-1.0, discipline_score=70)
    database_session.add_all([first, option])
    database_session.flush()
    first.executions.append(models.TradeExecution(execution_type="partial", price=110, quantity=2, exit_reason="partial_profit", executed_at=NOW - timedelta(hours=1)))
    first.executions.append(models.TradeExecution(execution_type="final", price=112, quantity=2, exit_reason="target_hit", executed_at=NOW))
    first.alerts.extend([
        models.Alert(rule_id="runner_must_have_protection", severity="warning", message="Protect runner"),
        models.Alert(rule_id="green_trade_should_not_go_red", severity="warning", message="Protect green trade"),
    ])
    first.review = models.Review(created_at=NOW + timedelta(hours=2), followed_plan="yes", discipline_score=90, mistake_tags=["late_entry"], positive_actions=[], score_band="strong", triggered_rules=[], trade_classification="good_trade_winner")
    option.review = models.Review(created_at=NOW + timedelta(hours=26), followed_plan="partial", discipline_score=70, mistake_tags=[], positive_actions=[], score_band="developing", triggered_rules=[], trade_classification="good_trade_loser")
    database_session.add(models.WorkflowEvent(event_type="trade_auto_closed", trade_id=first.id, occurred_at=NOW, event_data={}))
    database_session.add(models.WorkflowEvent(event_type="trade_updated", trade_id=first.id, occurred_at=NOW, event_data={"fields": ["runner_active"], "runner_active": True}))
    database_session.commit()

    body = get(api_client)
    execution = body["execution_discipline"]
    assert execution["trades_with_partial_exits"] == 1
    assert execution["partial_exit_rate"] == 0.5
    assert execution["average_number_of_exit_executions"] == 1.0
    assert execution["auto_closed_trade_count"] == 1
    assert execution["trades_with_runner_activated"] == 1
    assert execution["runner_without_stop_occurrences"] == 1
    assert execution["green_to_red_warning_occurrences"] == 1
    review = body["review_completion"]
    assert review["review_completion_rate"] == 1.0
    assert review["median_close_to_review_minutes"] == 810.0
    assert review["reviews_within_24_hours"] == 1
    assert review["review_within_24_hours_rate"] == 0.5
    assert body["outcome_context"] == {
        "total_underlying_r": 1.0, "average_underlying_r": 0.5,
        "median_underlying_r": 0.5, "average_discipline_score": 80.0,
    }


def test_notification_reliability_and_retry_exhaustion(api_client: TestClient, database_session: Session, monkeypatch) -> None:
    monkeypatch.setenv("PRICE_ALERT_RETRY_LIMIT", "3")
    position = trade(status="open", opened_at=NOW)
    database_session.add(position)
    database_session.flush()
    for index, (status, attempts) in enumerate((("sent", 1), ("failed", 3), ("pending", 0))):
        database_session.add(models.TradePriceAlertEvent(
            trade_id=position.id, alert_kind="target_1", threshold_price=110,
            observed_price=110, normalized_threshold_price="110.00",
            dedupe_key=f"stage26-{index}", notification_status=status,
            attempt_count=attempts, triggered_at=NOW + timedelta(minutes=index),
            updated_at=NOW + timedelta(minutes=index),
        ))
    database_session.commit()
    metrics = get(api_client)["notification_reliability"]
    assert metrics["threshold_events"] == 3
    assert metrics["emails_sent"] == 1
    assert metrics["emails_failed"] == 1
    assert metrics["email_success_rate"] == 0.5
    assert metrics["retry_exhausted_events"] == 1
    assert metrics["latest_failure_at"] is not None


def test_all_filters_leap_and_inclusive_utc_boundaries(api_client: TestClient, database_session: Session) -> None:
    database_session.add_all([
        trade(symbol="IN", created_at=datetime(2026, 7, 10, 23, 59, tzinfo=timezone.utc), trade_horizon="leap", market="options", setup="breakout", option_type="call", option_expiration=date(2027, 1, 15), option_strike=100, option_contract="IN"),
        trade(symbol="OUT", created_at=datetime(2026, 7, 11, 0, 0, tzinfo=timezone.utc), trade_horizon="leap", market="options", setup="breakout", option_type="call", option_expiration=date(2027, 1, 15), option_strike=100, option_contract="OUT"),
        trade(symbol="OTHER", created_at=NOW, trade_horizon="swing", market="stocks", setup="pullback"),
    ])
    database_session.commit()
    body = get(api_client, "?date_from=2026-07-10&date_to=2026-07-10&trade_horizon=leap&market=options&setup=breakout")
    assert body["planning_quality"]["plans_created"] == 1
    assert body["trade_horizon"] == "leap"
    assert body["timezone"] == "UTC"
