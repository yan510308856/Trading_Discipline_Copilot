from __future__ import annotations

import json
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from app import schemas
from app.services.price_action_taxonomy import (
    ENTRY_TRIGGERS,
    LOCATION_TAGS,
    MARKET_STATES,
    TAXONOMY_CONTRACT,
    TRADE_THESES,
)
from app.services.rule_engine import evaluate_trade


def structured_payload(**updates) -> dict:
    return {
        "symbol": "AAPL",
        "market": "stocks",
        "direction": "long",
        "trade_horizon": "swing",
        "market_state": "narrow_channel",
        "trade_thesis": "pullback_continuation",
        "entry_trigger": "second_entry",
        "location_tags": [],
        "location_decision": "none",
        "planned_entry": 100,
        "stop_loss": 95,
        "target_1": 110,
        "position_size": 2,
    } | updates


def test_explicit_location_and_reversal_invariants(api_client: TestClient) -> None:
    undecided = structured_payload()
    undecided.pop("location_decision")
    assert api_client.post("/trades", json=undecided).status_code == 422
    assert api_client.post(
        "/trades",
        json=structured_payload(location_decision="selected", location_tags=[]),
    ).status_code == 422
    assert api_client.post(
        "/trades",
        json=structured_payload(location_decision="none", location_tags=["support"]),
    ).status_code == 422

    reversal = structured_payload(trade_thesis="major_reversal")
    assert api_client.post("/trades", json=reversal).status_code == 422
    created = api_client.post(
        "/trades",
        json=reversal | {"reversal_confirmation": "unconfirmed"},
    )
    assert created.status_code == 201
    assert created.json()["is_unconfirmed_reversal"] is True


def test_planned_patch_rejects_legacy_writes_and_required_nulls(api_client: TestClient) -> None:
    trade = api_client.post("/trades", json=structured_payload()).json()
    legacy = api_client.patch(f"/trades/{trade['id']}", json={"setup": "breakout"})
    assert legacy.status_code == 409
    assert legacy.json()["error"]["code"] == "LEGACY_CLASSIFICATION_READ_ONLY"
    for field in ("market_state", "trade_thesis", "entry_trigger", "location_decision"):
        assert api_client.patch(f"/trades/{trade['id']}", json={field: None}).status_code == 422


def test_rule_deduplication_and_precision() -> None:
    breakout = evaluate_trade({
        "status": "planned", "market_state": "breakout_mode",
        "trade_thesis": "breakout", "entry_trigger": "other",
        "follow_through_confirmed": False, "stop_loss": 95,
    })
    assert {alert["rule_id"] for alert in breakout["alerts"]} == {
        "breakout_mode_direction_unconfirmed"
    }

    base = {
        "status": "planned", "market": "stocks", "market_state": "trading_range",
        "trade_thesis": "failed_breakout", "entry_trigger": "other",
        "stop_loss": 95, "location_tags": [],
    }
    assert "yesterday_high_low_two_failed_breakouts" not in {
        alert["rule_id"] for alert in evaluate_trade(base)["alerts"]
    }
    assert "yesterday_high_low_two_failed_breakouts" in {
        alert["rule_id"]
        for alert in evaluate_trade(base | {"location_tags": ["prior_day_high"]})["alerts"]
    }


def test_warning_dismissal_is_persistent_and_meaningful(api_client: TestClient) -> None:
    trade = api_client.post("/trades", json=structured_payload()).json()
    api_client.post(f"/trades/{trade['id']}/open", json={})
    api_client.patch(
        f"/trades/{trade['id']}",
        json={"runner_active": True, "runner_stop": None},
    )

    warning = next(
        item for item in api_client.get("/attention").json()["items"]
        if item.get("rule_id") == "runner_must_have_protection"
    )
    assert warning["dismissible"] is True
    dismissed = api_client.post("/warning-dismissals", json={
        "dismissal_key": warning["dismissal_key"],
        "occurrence_key": warning["occurrence_key"],
    })
    assert dismissed.status_code == 201
    assert not any(
        item.get("rule_id") == "runner_must_have_protection"
        for item in api_client.get("/attention").json()["items"]
    )

    api_client.patch(f"/trades/{trade['id']}", json={"notes": "Unrelated edit"})
    assert not any(
        item.get("rule_id") == "runner_must_have_protection"
        for item in api_client.get("/attention").json()["items"]
    )

    api_client.delete(f"/warning-dismissals/{warning['dismissal_key']}")
    assert any(
        item.get("rule_id") == "runner_must_have_protection"
        for item in api_client.get("/attention").json()["items"]
    )

    api_client.post("/warning-dismissals", json={
        "dismissal_key": warning["dismissal_key"],
        "occurrence_key": warning["occurrence_key"],
    })
    api_client.patch(f"/trades/{trade['id']}", json={"runner_stop": 99})
    api_client.patch(f"/trades/{trade['id']}", json={"runner_stop": None})
    reappeared = next(
        item for item in api_client.get("/attention").json()["items"]
        if item.get("rule_id") == "runner_must_have_protection"
    )
    assert reappeared["dismissal_key"] != warning["dismissal_key"]


def test_blockers_and_pretrade_warnings_are_not_dismissible(api_client: TestClient) -> None:
    pretrade = api_client.post("/rules/evaluate", json={
        "status": "planned", "trade_thesis": "breakout",
        "follow_through_confirmed": False, "stop_loss": 95,
    }).json()["alerts"][0]
    assert pretrade["dismissible"] is False
    invalid = api_client.post("/warning-dismissals", json={
        "dismissal_key": "warning:blocker:made-up",
        "occurrence_key": "occurrence:blocker:made-up",
    })
    assert invalid.status_code == 409


def test_enabled_incomplete_notifications_warn_but_disabled_is_neutral(
    api_client: TestClient, monkeypatch
) -> None:
    monkeypatch.setenv("EMAIL_NOTIFICATIONS_ENABLED", "false")
    assert not any(
        item["source_type"] == "notification_configuration"
        for item in api_client.get("/attention").json()["items"]
    )
    monkeypatch.setenv("EMAIL_NOTIFICATIONS_ENABLED", "true")
    monkeypatch.delenv("ALERT_RECIPIENT_EMAIL", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    warning = next(
        item for item in api_client.get("/attention").json()["items"]
        if item["source_type"] == "notification_configuration"
    )
    assert warning["dismissible"] is True


def test_shared_taxonomy_matches_backend_literals() -> None:
    expected = {
        "market_state": MARKET_STATES,
        "trade_thesis": TRADE_THESES,
        "entry_trigger": ENTRY_TRIGGERS,
        "location_tag": LOCATION_TAGS,
    }
    for category, values in expected.items():
        items = TAXONOMY_CONTRACT[category]
        assert tuple(item["value"] for item in items) == values
        assert [item["order"] for item in items] == list(range(1, len(items) + 1))
        assert len(values) == len(set(values))
    assert TAXONOMY_CONTRACT["market_state"][1]["english"] == "Narrow Channel"
    assert TAXONOMY_CONTRACT["market_state"][1]["chinese"] == "窄通道"
    assert set(schemas.MarketState.__args__) == set(MARKET_STATES)


def test_stage28_migration_backfills_conservatively(tmp_path: Path) -> None:
    database_path = tmp_path / "pre-stage28.db"
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path}")
    command.upgrade(config, "0014_price_action_taxonomy")
    engine = create_engine(f"sqlite:///{database_path}")
    with engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO trades "
            "(symbol, market, direction, setup, market_context, market_state, trade_thesis, entry_trigger, "
            "location_tags, is_unconfirmed_reversal, planned_entry, stop_loss, target_1, runner_enabled, "
            "runner_active, partial_taken, partial_exit_quantity, status, trade_horizon, created_at, updated_at) "
            "VALUES "
            "('ONE','stocks','long','pullback','strong_trend','strong_trend','pullback_continuation','other',"
            "'[\"support\"]',0,100,95,110,0,0,0,0,'planned','swing',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),"
            "('TWO','stocks','long','reversal','strong_trend','strong_trend','major_reversal','other',"
            "'[]',1,100,95,110,0,0,0,0,'planned','swing',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
        ))
    command.upgrade(config, "head")
    with engine.connect() as connection:
        rows = connection.execute(text(
            "SELECT symbol, location_decision, reversal_confirmation FROM trades ORDER BY symbol"
        )).all()
    assert rows == [("ONE", "selected", None), ("TWO", None, "unconfirmed")]
    assert "warning_dismissals" in inspect(engine).get_table_names()
