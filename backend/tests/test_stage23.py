import asyncio
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import models
from app.services.market_data import Quote, refresh_open_trade_prices
from app.services.price_alert_monitor import runtime_state
from app.services import price_alert_monitor
from app.services.trade_service import calculate_final_r


def payload(**updates) -> dict:
    return {
        "symbol": "AAPL", "market": "stocks", "direction": "long",
        "setup": "pullback", "market_context": "strong_trend",
        "planned_entry": 100, "stop_loss": 95, "target_1": 105,
        "position_size": 2,
    } | updates


def test_notification_status_distinguishes_configured_and_running(api_client: TestClient, monkeypatch) -> None:
    monkeypatch.setenv("PRICE_ALERT_MONITOR_ENABLED", "true")
    runtime_state.running = False
    body = api_client.get("/notifications/status").json()
    assert body["monitor_configured"] is True
    assert body["monitor_running"] is False
    runtime_state.running = True
    assert api_client.get("/notifications/status").json()["monitor_running"] is True
    runtime_state.running = False


def test_monitor_cycle_updates_runtime_timestamp(monkeypatch) -> None:
    stop_event = asyncio.Event()
    class Context:
        def __enter__(self): return object()
        def __exit__(self, *args): return None
    def refresh(database):
        stop_event.set()
        return [], []
    runtime_state.last_monitor_cycle_at = None
    monkeypatch.setattr(price_alert_monitor, "SessionLocal", Context)
    monkeypatch.setattr(price_alert_monitor, "refresh_open_trade_prices", refresh)
    monkeypatch.setattr(price_alert_monitor, "retry_unsent_events", lambda database: None)
    asyncio.run(price_alert_monitor.run_monitor(stop_event))
    assert runtime_state.last_monitor_cycle_at is not None
    assert runtime_state.running is False


def test_notification_status_returns_runtime_and_latest_email(api_client: TestClient, database_session: Session) -> None:
    cycle_at = datetime.now(timezone.utc)
    runtime_state.last_monitor_cycle_at = cycle_at
    trade = models.Trade(**payload(), status="open")
    database_session.add(trade)
    database_session.flush()
    database_session.add(models.TradePriceAlertEvent(
        trade_id=trade.id, alert_kind="target_1", threshold_price=105,
        observed_price=105, normalized_threshold_price="105.00",
        dedupe_key=f"trade:{trade.id}:price:105.00", notification_status="failed",
    ))
    database_session.commit()
    response = api_client.get("/notifications/status")
    body = response.json()
    assert body["last_monitor_cycle_at"] is not None
    assert body["latest_email_status"] == "failed"
    for secret in ("password", "api_key", "username"):
        assert secret not in response.text.lower()


def test_refresh_uses_stock_market_for_stocks_and_option_underlyings(database_session: Session) -> None:
    requested: list[tuple[str, str]] = []
    class Provider:
        def latest_quote(self, symbol: str, market: str) -> Quote:
            requested.append((symbol, market))
            return Quote(symbol, 104, "test-provider", 1700000000)
    for market in ("stocks", "options"):
        database_session.add(models.Trade(**payload(market=market), status="open"))
    database_session.commit()
    trades, errors = refresh_open_trade_prices(database_session, Provider())
    assert errors == []
    assert requested == [("AAPL", "stocks"), ("AAPL", "stocks")]
    assert all(trade.current_price_source == "test-provider" for trade in trades)
    assert all(trade.current_price_updated_at is not None for trade in trades)


def test_option_refresh_alert_and_r_remain_underlying_based(database_session: Session) -> None:
    class Provider:
        def latest_quote(self, symbol: str, market: str) -> Quote:
            return Quote(symbol, 105, "fake")
    trade = models.Trade(**payload(
        market="options", option_type="call", option_expiration=datetime(2027, 1, 15).date(),
        option_strike=200, option_contract="AAPL 2027-01-15 200C",
        option_entry_price=2.25,
    ), status="open")
    database_session.add(trade)
    database_session.commit()
    refresh_open_trade_prices(database_session, Provider())
    database_session.refresh(trade)
    assert calculate_final_r(trade, trade.current_price) == 1
    assert trade.price_alert_events[0].alert_kind == "target_1"


def test_manual_price_patch_records_source_and_timestamp(api_client: TestClient) -> None:
    trade = api_client.post("/trades", json=payload()).json()
    api_client.post(f"/trades/{trade['id']}/open", json={})
    body = api_client.patch(f"/trades/{trade['id']}", json={"current_price": 101}).json()
    assert body["current_price_source"] == "manual"
    assert body["current_price_updated_at"] is not None


def test_structured_option_rule_draft_is_complete(api_client: TestClient) -> None:
    complete = api_client.post("/rules/evaluate", json={
        "status": "planned", "market": "options", "option_contract": "AAPL 2027-01-15 200C",
    }).json()
    incomplete = api_client.post("/rules/evaluate", json={"status": "planned", "market": "options"}).json()
    assert "options_trade_missing_contract_details" not in {a["rule_id"] for a in complete["alerts"]}
    assert "options_trade_missing_contract_details" in {a["rule_id"] for a in incomplete["alerts"]}


def test_new_trade_requires_positive_position_size(api_client: TestClient) -> None:
    for value in (None, 0, -1):
        data = payload()
        if value is None:
            data.pop("position_size")
        else:
            data["position_size"] = value
        assert api_client.post("/trades", json=data).status_code == 422


def test_legacy_null_position_size_remains_patchable(api_client: TestClient, database_session: Session) -> None:
    trade = models.Trade(**payload(position_size=None), status="planned")
    database_session.add(trade)
    database_session.commit()
    response = api_client.patch(f"/trades/{trade.id}", json={"notes": "Legacy row retained"})
    assert response.status_code == 200
    assert response.json()["position_size"] is None
