from datetime import date, datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.services.price_alert_service import evaluate_trade_price_alerts


def payload(**updates) -> dict:
    return {
        "symbol": "AAPL", "market": "stocks", "direction": "long",
        "setup": "pullback", "market_context": "strong_trend",
        "planned_entry": 100, "stop_loss": 95, "target_1": 105,
        "position_size": 2,
    } | updates


def event_types(client: TestClient, trade_id: int) -> list[str]:
    return [item["event_type"] for item in client.get(f"/workflow-events?trade_id={trade_id}").json()]


def test_trade_lifecycle_writes_append_only_events(api_client: TestClient) -> None:
    trade = api_client.post("/trades", json=payload()).json()
    assert event_types(api_client, trade["id"]).count("plan_created") == 1
    api_client.post(f"/trades/{trade['id']}/open", json={})
    assert event_types(api_client, trade["id"]).count("trade_opened") == 1
    api_client.patch(f"/trades/{trade['id']}", json={"current_stop": 96})
    assert "trade_updated" in event_types(api_client, trade["id"])
    api_client.post(f"/trades/{trade['id']}/partial-exits", json={"price": 103, "quantity": 1, "exit_reason": "partial_profit"})
    assert event_types(api_client, trade["id"]).count("partial_exit_recorded") == 1
    api_client.post(f"/trades/{trade['id']}/partial-exits", json={"price": 105, "quantity": 1, "exit_reason": "target_hit"})
    assert event_types(api_client, trade["id"]).count("trade_auto_closed") == 1
    api_client.post(f"/trades/{trade['id']}/review", json={"followed_plan": "yes", "mistake_tags": [], "positive_actions": [], "lesson": None, "notes": None})
    assert event_types(api_client, trade["id"]).count("review_created") == 1


def test_manual_close_and_readiness_write_events(api_client: TestClient) -> None:
    trade = api_client.post("/trades", json=payload()).json()
    api_client.post(f"/trades/{trade['id']}/open", json={})
    api_client.post(f"/trades/{trade['id']}/close", json={"exit_price": 102, "exit_reason": "manual_exit"})
    assert event_types(api_client, trade["id"]).count("trade_manually_closed") == 1
    today = date.today().isoformat()
    readiness = api_client.get(f"/daily-readiness?date={today}").json()
    api_client.put(f"/daily-readiness/{today}", json={"items": [{"id": item["id"], "completed": item["completed"], "notes": item["notes"]} for item in readiness["items"]], "notes": None})
    events = api_client.get("/workflow-events?event_type=readiness_saved").json()
    assert len(events) == 1
    assert events[0]["readiness_date"] == today


class SuccessfulSender:
    provider_name = "test"
    def send_price_alert(self, trade, event): return None
    def send_test_email(self): return None


class FailedSender(SuccessfulSender):
    def send_price_alert(self, trade, event): raise RuntimeError("secret-password-must-not-leak")


def test_email_outcomes_write_safe_events(database_session: Session) -> None:
    sent_trade = models.Trade(**payload(symbol="SPY"), status="open", current_stop=95, current_price=105)
    failed_trade = models.Trade(**payload(symbol="QQQ"), status="open", current_stop=95, current_price=105)
    database_session.add_all([sent_trade, failed_trade])
    database_session.commit()
    evaluate_trade_price_alerts(database_session, sent_trade, SuccessfulSender())
    evaluate_trade_price_alerts(database_session, failed_trade, FailedSender())
    sent = database_session.scalar(select(models.WorkflowEvent).where(models.WorkflowEvent.event_type == "notification_email_sent"))
    failed = database_session.scalar(select(models.WorkflowEvent).where(models.WorkflowEvent.event_type == "notification_email_failed"))
    assert sent is not None and failed is not None
    assert failed.event_data["error_type"] == "RuntimeError"
    assert "secret-password" not in str(failed.event_data)


def test_plan_attempt_is_explicit_and_idempotent(api_client: TestClient) -> None:
    draft = {"status": "planned", "market": "stocks", "setup": "breakout", "stop_loss": 95, "follow_through_confirmed": False}
    for _ in range(3):
        assert api_client.post("/rules/evaluate", json=draft).status_code == 200
    assert api_client.get("/workflow-events?event_type=plan_warning_detected").json() == []
    attempted = draft | {"record_attempt": True, "planning_session_id": "session-1", "idempotency_key": "final-warning"}
    api_client.post("/rules/evaluate", json=attempted)
    api_client.post("/rules/evaluate", json=attempted)
    assert len(api_client.get("/workflow-events?event_type=plan_warning_detected").json()) == 1


def test_workflow_event_filters_and_trade_deletion_preserve_history(api_client: TestClient) -> None:
    first = api_client.post("/trades", json=payload(symbol="AAPL")).json()
    second = api_client.post("/trades", json=payload(symbol="MSFT")).json()
    now = datetime.now(timezone.utc)
    filtered = api_client.get(f"/workflow-events?event_type=plan_created&trade_id={first['id']}&date_from={(now - timedelta(minutes=1)).isoformat()}&date_to={(now + timedelta(minutes=1)).isoformat()}").json()
    assert len(filtered) == 1
    api_client.delete(f"/trades/{first['id']}")
    deleted_history = api_client.get("/workflow-events?event_type=plan_created").json()
    assert any(item["trade_id"] is None for item in deleted_history)
    unrelated = api_client.get(f"/workflow-events?trade_id={second['id']}").json()
    assert len(unrelated) == 1
