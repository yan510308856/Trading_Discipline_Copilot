from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import models


def payload(**updates) -> dict:
    return {
        "symbol": "AAPL", "market": "stocks", "direction": "long",
        "setup": "pullback", "market_context": "strong_trend",
        "planned_entry": 100, "stop_loss": 95, "target_1": 110,
        "position_size": 2, "trade_horizon": "swing",
    } | updates


def attention(api_client: TestClient, horizon: str | None = None) -> dict:
    suffix = f"?trade_horizon={horizon}" if horizon else ""
    return api_client.get(f"/attention{suffix}").json()


def test_allowed_open_trade_is_excluded(api_client: TestClient) -> None:
    trade = api_client.post("/trades", json=payload()).json()
    api_client.post(f"/trades/{trade['id']}/open", json={})
    ids = {item["trade_id"] for item in attention(api_client)["items"] if item["source_type"] != "notification_configuration"}
    assert trade["id"] not in ids


def test_attention_orders_blocker_warning_then_reminder(api_client: TestClient, database_session: Session) -> None:
    trade = models.Trade(**payload(position_size=None), status="open", current_stop=None,
                         current_price=105, runner_active=True, runner_stop=None,
                         opened_at=models.utc_now())
    database_session.add(trade)
    database_session.commit()
    severities = [item["severity"] for item in attention(api_client)["items"] if item["trade_id"] == trade.id]
    assert severities == sorted(severities, key={"blocker": 0, "warning": 1, "reminder": 2}.get)
    assert {"blocker", "warning", "reminder"}.issubset(severities)


def test_pending_review_and_failed_email_are_actionable(api_client: TestClient, database_session: Session) -> None:
    closed = models.Trade(**payload(symbol="TSLA"), status="closed", closed_at=models.utc_now(), final_r=1.5)
    opened = models.Trade(**payload(symbol="SPY"), status="open", current_stop=95, opened_at=models.utc_now())
    database_session.add_all([closed, opened])
    database_session.flush()
    event = models.TradePriceAlertEvent(
        trade_id=opened.id, alert_kind="target_1", threshold_price=110,
        observed_price=110, normalized_threshold_price="110.00",
        dedupe_key=f"trade:{opened.id}:price:110.00", notification_status="failed",
        last_error="Authentication failed",
    )
    database_session.add(event)
    database_session.commit()
    items = attention(api_client)["items"]
    assert any(item["source_type"] == "pending_review" and item["trade_id"] == closed.id for item in items)
    assert any(item["source_type"] == "failed_email" and item["trade_id"] == opened.id for item in items)
    event.notification_status = "sent"
    database_session.commit()
    assert not any(item["source_type"] == "failed_email" for item in attention(api_client)["items"])


def test_intentionally_disabled_notifications_and_stale_price_are_not_attention(api_client: TestClient, database_session: Session, monkeypatch) -> None:
    monkeypatch.setenv("PRICE_ALERT_MONITOR_ENABLED", "false")
    trade = models.Trade(**payload(), status="open", current_stop=95, current_price=101,
                         current_price_source="finnhub",
                         current_price_updated_at=datetime.now(timezone.utc) - timedelta(minutes=5),
                         opened_at=models.utc_now())
    database_session.add(trade)
    database_session.commit()
    sources = {item["source_type"] for item in attention(api_client)["items"]}
    assert "notification_configuration" not in sources
    assert "stale_price" not in sources


def test_horizon_filter_shape_and_count_are_stable(api_client: TestClient, database_session: Session) -> None:
    database_session.add_all([
        models.Trade(**payload(symbol="AAPL", trade_horizon="swing"), status="closed", closed_at=models.utc_now()),
        models.Trade(**payload(symbol="QQQ", trade_horizon="intraday"), status="closed", closed_at=models.utc_now()),
    ])
    database_session.commit()
    body = attention(api_client, "swing")
    assert body["actionable_count"] == len(body["items"])
    assert all(item["trade_horizon"] == "swing" for item in body["items"])
    assert set(body["counts"]) == {"blocker", "warning", "reminder"}
    assert set(body["items"][0]) == {
        "id", "source_type", "severity", "title", "message", "required_action",
        "trade_id", "symbol", "trade_horizon", "current_r", "detected_at",
        "destination_page", "destination_context", "time_sensitive",
        "dismissible", "dismissal_key", "occurrence_key",
        "source_id", "rule_id",
    }
