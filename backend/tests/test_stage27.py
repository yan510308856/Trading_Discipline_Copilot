from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.services.price_action_taxonomy import classification_from_legacy
from app.services.rule_engine import RuleEngine, evaluate_trade
from app.services.rule_schema import RuleConditionModel


def payload(**updates) -> dict:
    values = {
        "symbol": "AAPL", "market": "stocks", "direction": "long", "trade_horizon": "swing",
        "market_state": "narrow_channel", "trade_thesis": "pullback_continuation",
        "entry_trigger": "h1_h2_l1_l2", "location_tags": ["prior_day_low", "support"],
        "planned_entry": 100, "stop_loss": 95, "target_1": 110, "position_size": 2,
    }
    values.update(updates)
    return values


@pytest.mark.parametrize("market_state", ["strong_trend", "narrow_channel", "broad_channel", "trading_range", "breakout_mode", "unclear"])
def test_valid_market_states_and_legacy_mirrors(api_client: TestClient, market_state: str) -> None:
    response = api_client.post("/trades", json=payload(market_state=market_state))
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["market_state"] == market_state
    assert body["setup"] == "pullback"
    assert body["market_context"] == ({"unclear": "uncertain"}.get(market_state, market_state))


def test_taxonomy_validation_persistence_and_default(api_client: TestClient) -> None:
    response = api_client.post("/trades", json=payload(location_tags=["support", "support", "prior_day_low"], trade_thesis="breakout_pullback", entry_trigger="wedge"))
    assert response.status_code == 201
    body = response.json()
    assert body["trade_thesis"] == "breakout_pullback"
    assert body["entry_trigger"] == "wedge"
    assert body["location_tags"] == ["prior_day_low", "support"]
    assert body["is_unconfirmed_reversal"] is False
    assert api_client.post("/trades", json=payload(market_state="tight_channel")).status_code == 422
    assert api_client.post("/trades", json=payload(location_tags=["vwap"])).status_code == 422


def test_legacy_payload_remains_compatible(api_client: TestClient) -> None:
    legacy = payload()
    for field in ("market_state", "trade_thesis", "entry_trigger", "location_tags"):
        legacy.pop(field, None)
    legacy.update(setup="wedge", market_context="weak_trend")
    response = api_client.post("/trades", json=legacy)
    assert response.status_code == 201, response.text
    body = response.json()
    assert (body["market_state"], body["trade_thesis"], body["entry_trigger"]) == ("broad_channel", "other", "wedge")


def test_conservative_legacy_mapping() -> None:
    assert classification_from_legacy("wedge", "weak_trend") | {} == {
        "market_state": "broad_channel", "trade_thesis": "other", "entry_trigger": "wedge",
        "location_tags": [], "location_decision": None,
        "reversal_confirmation": None, "is_unconfirmed_reversal": False,
    }
    assert classification_from_legacy("breakout", "narrow_channel")["market_state"] == "narrow_channel"
    assert classification_from_legacy("opening_range", "opening_range")["location_tags"] == ["opening_range"]
    assert classification_from_legacy("gap_open", "gap_open")["location_tags"] == ["gap_open"]
    assert classification_from_legacy("bottom_pick", "strong_trend")["is_unconfirmed_reversal"] is True


def test_unconfirmed_reversal_rules() -> None:
    facts = {"status": "planned", "market_state": "strong_trend", "trade_thesis": "major_reversal", "entry_trigger": "other", "is_unconfirmed_reversal": True, "stop_loss": 95}
    options = evaluate_trade(facts | {"market": "options"})
    stocks = evaluate_trade(facts | {"market": "stocks"})
    assert options["status"] == "blocked"
    assert "no_options_for_left_side_bottom_picking" in {item["rule_id"] for item in options["alerts"]}
    assert stocks["status"] == "warning"
    assert any(item["requires_acknowledgement"] for item in stocks["alerts"])


def test_classification_is_immutable_after_open(api_client: TestClient) -> None:
    trade = api_client.post("/trades", json=payload()).json()
    api_client.post(f"/trades/{trade['id']}/open", json={})
    response = api_client.patch(f"/trades/{trade['id']}", json={"trade_thesis": "breakout"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "IMMUTABLE_TRADE_FACTS"


def test_list_operators_and_schema_validation() -> None:
    base = {"id": "list-rule", "name": "list", "category": "test", "stage": "pre_trade", "severity": "warning", "trigger": {}, "message": "match", "checklist": [], "next_actions": [], "ui_hints": {}, "requires_acknowledgement": False, "avoid": "none", "discipline_sentence": "test", "enabled": True}
    def matches(operator: str, value) -> bool:
        result = RuleEngine([base | {"conditions": [{"field": "location_tags", "operator": operator, "value": value}]}]).evaluate({"location_tags": ["support", "range_low"]})
        return bool(result["alerts"])
    assert matches("contains", "support")
    assert matches("contains_any", ["range_high", "range_low"])
    assert matches("contains_none", ["gap_open", "range_high"])
    with pytest.raises(ValidationError):
        RuleConditionModel(field="location_tags", operator="contains_any", value="support")


def test_trade_taxonomy_filters(api_client: TestClient) -> None:
    first = api_client.post("/trades", json=payload(symbol="ONE")).json()
    api_client.post("/trades", json=payload(symbol="TWO", market_state="trading_range", trade_thesis="range_reversal", entry_trigger="wedge", location_tags=["range_low"])).json()
    cases = {
        "market_state=narrow_channel": first["id"], "trade_thesis=pullback_continuation": first["id"],
        "entry_trigger=h1_h2_l1_l2": first["id"], "location_tag=support": first["id"],
    }
    for query, expected in cases.items():
        response = api_client.get(f"/trades?{query}")
        assert response.status_code == 200, response.text
        assert [item["id"] for item in response.json()] == [expected]
    assert api_client.get("/trades?location_tag=vwap").status_code == 422
    analytics = api_client.get("/analytics/discipline?market_state=narrow_channel&trade_thesis=pullback_continuation&entry_trigger=h1_h2_l1_l2&location_tag=support")
    assert analytics.status_code == 200, analytics.text
    assert analytics.json()["planning_quality"]["plans_created"] == 1
