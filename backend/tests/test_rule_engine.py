import pytest
import yaml
from typing import Optional

from app.services.rule_engine import RuleEngine, evaluate_trade, load_rules


def valid_rule_document(condition: Optional[dict] = None, **overrides: object) -> dict:
    rule = {
        "id": "test_rule",
        "name": "Test rule",
        "category": "test",
        "stage": "pre_trade",
        "severity": "warning",
        "trigger": {"status": "planned"},
        "conditions": [] if condition is None else [condition],
        "message": "Test message.",
        "checklist": ["Check the test rule."],
        "next_actions": ["Act on the test rule."],
        "ui_hints": {},
        "requires_acknowledgement": False,
        "avoid": "Avoid invalid test behavior.",
        "discipline_sentence": "Test discipline sentence.",
        "enabled": True,
    } | overrides
    return {"version": 1, "rules": [rule]}


def write_rule_document(tmp_path, document: dict) -> object:
    path = tmp_path / "rules.yaml"
    path.write_text(yaml.safe_dump(document), encoding="utf-8")
    return path


def alert_ids(result: dict) -> set[str]:
    return {alert["rule_id"] for alert in result["alerts"]}


def test_yaml_contains_all_mvp_rules() -> None:
    rule_ids = {rule["id"] for rule in load_rules()}

    assert rule_ids == {
        "every_order_must_have_stop_loss",
        "no_reverse_trade_immediately_after_stop_loss",
        "breakout_needs_follow_through",
        "trading_range_second_leg_trap",
        "trading_range_big_bar_reversal_risk",
        "inside_bar_triangle_breakout_setup",
        "yesterday_high_low_two_failed_breakouts",
        "breakout_gap_no_retest_strength",
        "signal_context_over_shape",
        "no_options_for_left_side_bottom_picking",
        "left_side_stock_only_small_size",
        "options_trade_missing_contract_details",
        "take_profit_and_let_runner_run",
        "green_trade_should_not_go_red",
        "runner_must_have_protection",
    }


def test_current_price_action_rules_validate() -> None:
    assert len(load_rules()) == 15


def test_missing_top_level_rules_fails(tmp_path) -> None:
    path = write_rule_document(tmp_path, {"version": 1})

    with pytest.raises(ValueError, match="top-level 'rules' list"):
        load_rules(path)


def test_unsupported_operator_fails(tmp_path) -> None:
    path = write_rule_document(
        tmp_path,
        valid_rule_document({"field": "status", "operator": "contains", "value": "planned"}),
    )

    with pytest.raises(ValueError, match="Unsupported rule operator: contains"):
        load_rules(path)


def test_invalid_severity_fails(tmp_path) -> None:
    path = write_rule_document(tmp_path, valid_rule_document(severity="critical"))

    with pytest.raises(ValueError, match="severity"):
        load_rules(path)


def test_compare_field_operator_requires_compare_field(tmp_path) -> None:
    path = write_rule_document(
        tmp_path,
        valid_rule_document({"field": "target_1", "operator": "greater_than_field"}),
    )

    with pytest.raises(ValueError, match="requires compare_field"):
        load_rules(path)


def test_in_operator_requires_list_value(tmp_path) -> None:
    path = write_rule_document(
        tmp_path,
        valid_rule_document({"field": "setup", "operator": "in", "value": "breakout"}),
    )

    with pytest.raises(ValueError, match="requires a list value"):
        load_rules(path)


def test_uncertain_context_warns_even_with_a_familiar_signal_shape() -> None:
    result = evaluate_trade(
        {"status": "planned", "stop_loss": 4990, "market_context": "uncertain"}
    )

    assert "signal_context_over_shape" in alert_ids(result)


def test_missing_stop_loss_blocks_planned_trade() -> None:
    result = evaluate_trade({"status": "planned", "stop_loss": None})

    assert result["status"] == "blocked"
    assert alert_ids(result) == {"every_order_must_have_stop_loss"}
    assert result["alerts"][0]["severity"] == "blocker"
    assert result["alerts"][0]["checklist"]
    assert result["alerts"][0]["discipline_sentence"]
    assert result["alerts"][0]["next_actions"]
    assert result["alerts"][0]["ui_hints"]["emphasis"] == "hard_block"


def test_breakout_without_follow_through_returns_warning() -> None:
    result = evaluate_trade(
        {
            "status": "planned",
            "stop_loss": 4990,
            "setup": "breakout",
            "follow_through_confirmed": False,
        }
    )

    assert result["status"] == "warning"
    assert alert_ids(result) == {"breakout_needs_follow_through"}
    assert result["alerts"][0]["severity"] == "warning"
    assert result["alerts"][0]["requires_acknowledgement"] is True
    assert result["alerts"][0]["next_actions"]


def test_options_left_side_bottom_pick_is_blocked() -> None:
    result = evaluate_trade(
        {
            "status": "planned",
            "market": "options",
            "setup": "left_side_bottom_pick",
            "stop_loss": 120,
        }
    )

    assert result["status"] == "blocked"
    assert "no_options_for_left_side_bottom_picking" in alert_ids(result)
    assert result["alerts"][0]["severity"] == "blocker"
    assert "options" in result["alerts"][0]["message"].lower()


def test_stocks_left_side_bottom_pick_returns_acknowledged_warning() -> None:
    result = evaluate_trade(
        {
            "status": "planned",
            "market": "stocks",
            "setup": "left_side_bottom_pick",
            "stop_loss": 120,
        }
    )

    assert result["status"] == "warning"
    assert alert_ids(result) == {"left_side_stock_only_small_size"}
    assert result["alerts"][0]["severity"] == "warning"
    assert result["alerts"][0]["requires_acknowledgement"] is True
    assert "small" in " ".join(result["alerts"][0]["checklist"]).lower()


def test_options_trade_without_contract_details_warns() -> None:
    result = evaluate_trade(
        {
            "status": "planned",
            "market": "options",
            "setup": "breakout",
            "stop_loss": 3.5,
            "option_contract": None,
            "follow_through_confirmed": True,
        }
    )

    assert result["status"] == "warning"
    assert alert_ids(result) == {"options_trade_missing_contract_details"}
    assert result["alerts"][0]["requires_acknowledgement"] is True


def test_options_trade_with_contract_details_does_not_warn_for_missing_contract() -> None:
    result = evaluate_trade(
        {
            "status": "planned",
            "market": "options",
            "setup": "breakout",
            "stop_loss": 3.5,
            "option_contract": "AAPL 2026-01-16 200C",
            "follow_through_confirmed": True,
        }
    )

    assert "options_trade_missing_contract_details" not in alert_ids(result)


def test_open_trade_at_one_r_returns_partial_profit_reminder() -> None:
    result = evaluate_trade(
        {"status": "open", "current_r": 1, "partial_taken": False}
    )

    assert result["status"] == "warning"
    assert alert_ids(result) == {"take_profit_and_let_runner_run"}
    assert result["alerts"][0]["severity"] == "reminder"


def test_active_runner_without_stop_returns_warning() -> None:
    result = evaluate_trade(
        {"status": "open", "runner_active": True, "runner_stop": None}
    )

    assert result["status"] == "warning"
    assert alert_ids(result) == {"runner_must_have_protection"}


def test_trade_without_violations_is_allowed() -> None:
    result = evaluate_trade(
        {
            "status": "planned",
            "stop_loss": 4990,
            "setup": "breakout",
            "follow_through_confirmed": True,
        }
    )

    assert result == {"status": "allowed", "alerts": []}


def test_compare_field_condition_compares_two_trade_values() -> None:
    rules = [
        {
            "id": "long_target_below_entry",
            "severity": "blocker",
            "trigger": {"direction": "long"},
            "conditions": [
                {
                    "field": "target_1",
                    "operator": "less_than_field",
                    "compare_field": "planned_entry",
                }
            ],
            "message": "A long target must be above entry.",
            "checklist": ["Is the target above entry?"],
            "discipline_sentence": "Validate price direction before submitting.",
            "enabled": True,
        }
    ]

    result = RuleEngine(rules).evaluate(
        {"direction": "long", "planned_entry": 5000, "target_1": 4990}
    )

    assert result["status"] == "blocked"
    assert alert_ids(result) == {"long_target_below_entry"}


def test_existing_rules_without_new_alert_metadata_still_work() -> None:
    rules = [
        {
            "id": "legacy_warning",
            "severity": "warning",
            "trigger": {"setup": "breakout"},
            "conditions": [],
            "message": "Legacy rule still evaluates.",
            "checklist": [],
            "discipline_sentence": "",
            "enabled": True,
        }
    ]

    result = RuleEngine(rules).evaluate({"setup": "breakout"})

    assert result == {
        "status": "warning",
        "alerts": [
            {
                "rule_id": "legacy_warning",
                "severity": "warning",
                "message": "Legacy rule still evaluates.",
                "checklist": [],
                "discipline_sentence": "",
                "next_actions": [],
                "ui_hints": {},
                "requires_acknowledgement": False,
            }
        ],
    }
