from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import models
from app.services.price_alert_service import evaluate_trade_price_alerts
from app.services.option_contract_service import resolved_underlying_direction, underlying_direction


def payload(**updates) -> dict:
    base = {"symbol": "AAPL", "market": "stocks", "direction": "long", "setup": "pullback", "market_context": "strong_trend", "planned_entry": 100, "stop_loss": 95, "target_1": 105, "target_2": 110, "position_size": 1}
    return base | updates


class FakeSender:
    provider_name = "fake"
    def __init__(self) -> None: self.sent = 0
    def send_price_alert(self, trade, event) -> None: self.sent += 1
    def send_test_email(self) -> None: self.sent += 1


def test_manual_price_patch_creates_durable_deduplicated_alert(api_client: TestClient, database_session: Session) -> None:
    trade = api_client.post("/trades", json=payload()).json()
    api_client.post(f"/trades/{trade['id']}/open", json={})
    assert api_client.patch(f"/trades/{trade['id']}", json={"current_price": 105}).status_code == 200
    assert api_client.patch(f"/trades/{trade['id']}", json={"current_price": 106}).status_code == 200
    events = api_client.get(f"/trades/{trade['id']}/price-alert-events").json()
    assert len(events) == 1
    assert events[0]["alert_kind"] == "target_1"


def test_fake_sender_sends_successful_event_once(api_client: TestClient, database_session: Session) -> None:
    created = api_client.post("/trades", json=payload()).json()
    api_client.post(f"/trades/{created['id']}/open", json={})
    trade = database_session.get(models.Trade, created["id"])
    trade.current_price = 105
    database_session.commit()
    sender = FakeSender()
    evaluate_trade_price_alerts(database_session, trade, sender)
    evaluate_trade_price_alerts(database_session, trade, sender)
    assert sender.sent == 1


def test_exact_remaining_execution_closes_and_weights_r(api_client: TestClient) -> None:
    created = api_client.post("/trades", json=payload(position_size=1.0)).json()
    api_client.post(f"/trades/{created['id']}/open", json={})
    partial = api_client.post(f"/trades/{created['id']}/partial-exits", json={"price": 105, "quantity": .4, "exit_reason": "partial_profit"})
    closed = api_client.post(f"/trades/{created['id']}/partial-exits", json={"price": 110, "quantity": .6, "exit_reason": "target_hit"})
    assert partial.json()["status"] == "open"
    assert closed.json()["status"] == "closed"
    assert closed.json()["exit_reason"] == "target_hit"
    assert closed.json()["final_r"] == 1.6


def test_structured_option_contract_is_canonical(api_client: TestClient) -> None:
    response = api_client.post("/trades", json=payload(market="options", option_type="call", option_expiration="2027-01-15", option_strike=200))
    assert response.status_code == 201
    assert response.json()["option_contract"] == "AAPL 2027-01-15 200C"


def test_notification_status_does_not_expose_secrets(api_client: TestClient) -> None:
    response = api_client.get("/notifications/status")
    assert response.status_code == 200
    assert "password" not in response.text.lower()


def test_option_premiums_are_stored_with_trade_and_execution(api_client: TestClient) -> None:
    created = api_client.post("/trades", json=payload(
        market="options", option_type="call", option_expiration="2027-01-15",
        option_strike=200,
    )).json()
    opened = api_client.post(
        f"/trades/{created['id']}/open",
        json={"option_entry_price": 2.25},
    )
    assert opened.json()["option_entry_price"] == 2.25
    response = api_client.post(f"/trades/{created['id']}/partial-exits", json={
        "price": 106, "option_price": 2.75, "quantity": 1,
        "exit_reason": "target_hit",
    })
    assert response.status_code == 201
    assert response.json()["option_entry_price"] == 2.25
    assert response.json()["executions"][0]["option_price"] == 2.75


def test_option_action_and_type_map_to_underlying_direction() -> None:
    assert underlying_direction("options", "long", "call") == "long"
    assert underlying_direction("options", "short", "put") == "long"
    assert underlying_direction("options", "long", "put") == "short"
    assert underlying_direction("options", "short", "call") == "short"
    assert resolved_underlying_direction("options", "long", "put", 111, 110) == "long"
