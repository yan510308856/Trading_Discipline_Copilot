"""Load and evaluate machine-readable trading discipline rules."""

from __future__ import annotations

from collections.abc import Mapping
import hashlib
import json
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
    if operator in {"contains", "contains_any", "contains_none"}:
        if not isinstance(actual, list):
            return False
        expected = condition.get("value")
        if operator == "contains":
            return expected in actual
        if not isinstance(expected, list):
            raise ValueError(f"Operator '{operator}' requires a list value")
        found = any(value in actual for value in expected)
        return found if operator == "contains_any" else not found
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
        matched: list[tuple[dict[str, Any], dict[str, Any]]] = []

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

            matched.append(
                (rule, {
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
                })
            )

        matched_ids = {rule["id"] for rule, _ in matched}
        suppressed_ids = {
            suppressed
            for rule, _ in matched
            for suppressed in rule.get("suppresses", [])
            if suppressed in matched_ids
        }
        candidates = [(rule, alert) for rule, alert in matched if rule["id"] not in suppressed_ids]
        severity_rank = {"blocker": 3, "warning": 2, "reminder": 1}
        grouped: dict[str, list[tuple[dict[str, Any], dict[str, Any]]]] = {}
        ungrouped: list[tuple[dict[str, Any], dict[str, Any]]] = []
        for candidate in candidates:
            group = candidate[0].get("dedupe_group")
            (grouped.setdefault(group, []) if group else ungrouped).append(candidate)
        winners = ungrouped + [
            sorted(
                group_candidates,
                key=lambda pair: (
                    -severity_rank[pair[0]["severity"]],
                    -pair[0].get("priority", 0),
                    pair[0]["id"],
                ),
            )[0]
            for group_candidates in grouped.values()
        ]
        alerts = [alert for _, alert in sorted(winners, key=lambda pair: pair[0]["id"])]
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
    values = dict(_trade_values(trade))
    if values.get("reversal_confirmation") is None and values.get("is_unconfirmed_reversal") is True:
        values["reversal_confirmation"] = "unconfirmed"
    if not all(values.get(field) for field in ("market_state", "trade_thesis", "entry_trigger")):
        from app.services.price_action_taxonomy import classification_from_legacy
        mapped = classification_from_legacy(values.get("setup"), values.get("market_context"))
        if not values.get("market_context"):
            mapped.pop("market_state", None)
        if not values.get("setup"):
            mapped.pop("trade_thesis", None)
            mapped.pop("entry_trigger", None)
            mapped.pop("is_unconfirmed_reversal", None)
        values |= mapped
    return RuleEngine().evaluate(values)


def rule_warning_identity(
    trade: object, rule_id: str, *, trade_id: int, occurrence_token: str = "initial"
) -> tuple[str, str]:
    """Build identity only from facts used to match one YAML warning."""

    values = dict(_trade_values(trade))
    rule = next(rule for rule in load_rules() if rule["id"] == rule_id)
    facts: dict[str, Any] = {
        "trade_id": trade_id,
        "rule_id": rule_id,
        "severity": rule["severity"],
        "occurrence_token": occurrence_token,
        "trigger": {field: values.get(field) for field in sorted(rule.get("trigger", {}))},
        "conditions": [],
    }
    for condition in rule.get("conditions", []):
        condition_fact = {
            "field": condition["field"],
            "operator": condition["operator"],
            "actual": values.get(condition["field"]),
            "value": condition.get("value"),
        }
        if condition.get("compare_field"):
            condition_fact["compare_field"] = condition["compare_field"]
            condition_fact["compare_actual"] = values.get(condition["compare_field"])
        facts["conditions"].append(condition_fact)
    digest = hashlib.sha256(
        json.dumps(facts, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()[:32]
    return (
        f"warning:rule:{trade_id}:{rule_id}:{digest}",
        f"occurrence:rule:{trade_id}:{rule_id}:{digest}",
    )


def rule_occurrence_token(trade: object, rule_id: str) -> str:
    """Return the latest audit event that changed a fact relevant to the rule."""

    rule = next(rule for rule in load_rules() if rule["id"] == rule_id)
    relevant_fields = set(rule.get("trigger", {}))
    for condition in rule.get("conditions", []):
        relevant_fields.add(condition["field"])
        if condition.get("compare_field"):
            relevant_fields.add(condition["compare_field"])
    relevant_events = [
        event
        for event in getattr(trade, "workflow_events", [])
        if relevant_fields.intersection(event.event_data.get("fields", []))
    ]
    if not relevant_events:
        return "initial"
    return max(event.occurred_at for event in relevant_events).isoformat()
