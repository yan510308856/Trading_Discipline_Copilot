"""Load and evaluate machine-readable trading discipline rules."""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from typing import Any

import yaml

from app.services.rule_schema import SUPPORTED_OPERATORS, RuleDocumentModel

DEFAULT_RULES_PATH = Path(__file__).parents[1] / "rules" / "price_action_rules.yaml"


def load_rules(path: Path | str = DEFAULT_RULES_PATH) -> list[dict[str, Any]]:
    """Load the rule list from a YAML file."""

    with Path(path).open(encoding="utf-8") as rules_file:
        document = yaml.safe_load(rules_file) or {}

    if "rules" not in document:
        raise ValueError("Rules YAML must contain a top-level 'rules' list")
    return RuleDocumentModel.model_validate(document).model_dump(exclude_none=True)["rules"]


def _trade_values(trade: object) -> Mapping[str, Any]:
    if isinstance(trade, Mapping):
        return trade
    if hasattr(trade, "model_dump"):
        return trade.model_dump()
    if hasattr(trade, "__dict__"):
        return vars(trade)
    raise TypeError("Trade must be a mapping, Pydantic model, or model object")


def _is_missing(value: Any) -> bool:
    return value is None or value == ""


def _condition_matches(condition: Mapping[str, Any], trade: Mapping[str, Any]) -> bool:
    field = condition["field"]
    operator = condition["operator"]
    actual = trade.get(field)

    if operator not in SUPPORTED_OPERATORS:
        raise ValueError(f"Unsupported rule operator: {operator}")
    if operator == "missing":
        return _is_missing(actual)
    if operator == "equals":
        return actual == condition.get("value")
    if operator == "in":
        expected_values = condition.get("value", [])
        if not isinstance(expected_values, list):
            raise ValueError("Operator 'in' requires a list value")
        return actual in expected_values
    if _is_missing(actual):
        return False

    if operator.endswith("_field"):
        compare_field = condition.get("compare_field")
        if not compare_field:
            raise ValueError(f"Operator '{operator}' requires compare_field")
        expected = trade.get(compare_field)
        if _is_missing(expected):
            return False
    else:
        expected = condition.get("value")

    comparisons = {
        "greater_than": lambda: actual > expected,
        "greater_than_or_equal": lambda: actual >= expected,
        "less_than": lambda: actual < expected,
        "less_than_or_equal": lambda: actual <= expected,
        "greater_than_field": lambda: actual > expected,
        "less_than_field": lambda: actual < expected,
    }
    try:
        return comparisons[operator]()
    except TypeError as error:
        raise ValueError(
            f"Cannot compare values for field '{field}' with operator '{operator}'"
        ) from error


def _trigger_matches(trigger: Mapping[str, Any], trade: Mapping[str, Any]) -> bool:
    return all(trade.get(field) == expected for field, expected in trigger.items())


class RuleEngine:
    """Evaluate enabled rules against a trade draft or open trade."""

    def __init__(self, rules: list[dict[str, Any]] | None = None) -> None:
        self.rules = rules if rules is not None else load_rules()

    def evaluate(self, trade: object) -> dict[str, Any]:
        trade_values = _trade_values(trade)
        alerts = []

        for rule in self.rules:
            if not rule.get("enabled", True):
                continue
            if not _trigger_matches(rule.get("trigger", {}), trade_values):
                continue
            if not all(
                _condition_matches(condition, trade_values)
                for condition in rule.get("conditions", [])
            ):
                continue

            alerts.append(
                {
                    "rule_id": rule["id"],
                    "severity": rule["severity"],
                    "message": rule["message"],
                    "checklist": rule.get("checklist", []),
                    "discipline_sentence": rule.get("discipline_sentence", ""),
                    "next_actions": rule.get("next_actions", []),
                    "ui_hints": rule.get("ui_hints", {}),
                    "requires_acknowledgement": rule.get(
                        "requires_acknowledgement", False
                    ),
                }
            )

        severities = {alert["severity"] for alert in alerts}
        if "blocker" in severities:
            status = "blocked"
        elif alerts:
            status = "warning"
        else:
            status = "allowed"

        return {"status": status, "alerts": alerts}


def evaluate_trade(trade: object) -> dict[str, Any]:
    """Evaluate a trade with the default price-action rules."""

    return RuleEngine().evaluate(trade)
