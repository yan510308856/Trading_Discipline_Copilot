# Rule Authoring Guide

This guide explains how to add or edit price-action rules in
`backend/app/rules/price_action_rules.yaml`.

## Add a Rule

1. Add a new item under the top-level `rules` list.
2. Give it a stable `id` using snake_case.
3. Fill every required field.
4. Add or update backend tests in `backend/tests/test_rule_engine.py`.
5. Run `cd backend && pytest -q`.

Required rule fields:

```yaml
id: string
name: string
category: string
stage: pre_trade | in_trade | post_trade
severity: blocker | warning | reminder
priority: integer (optional, -1000..1000)
dedupe_group: string (optional)
suppresses: [rule_id] (optional)
trigger: {}
conditions: []
message: string
checklist: []
next_actions: []
ui_hints: {}
requires_acknowledgement: false
avoid: string
discipline_sentence: string
enabled: true
```

## Trigger And Conditions

`trigger` is a quick match on trade fields. Every trigger field must equal the
trade value before conditions are checked.

```yaml
trigger:
  status: planned
  setup: breakout
```

`conditions` are detailed checks. All conditions must match for the rule to
produce an alert.

```yaml
conditions:
  - field: follow_through_confirmed
    operator: equals
    value: false
```

Use `conditions: []` when the trigger alone is enough.

## Supported Operators

```text
missing
equals
in
contains
contains_any
contains_none
greater_than
greater_than_or_equal
less_than
less_than_or_equal
greater_than_field
less_than_field
```

Examples:

```yaml
- field: stop_loss
  operator: missing
```

```yaml
- field: setup
  operator: in
  value:
    - left_side_bottom_pick
    - early_reversal
```

```yaml
- field: target_1
  operator: greater_than_field
  compare_field: planned_entry
```

`in` requires `value` to be a list. Field comparison operators require
`compare_field`.

`contains` checks one scalar member in a list-valued trade field. `contains_any`
and `contains_none` require list values and are intended for JSON fields such as
`location_tags`:

```yaml
- field: location_tags
  operator: contains_none
  value:
    - range_high
    - range_low
```

Stage 28 rules should use `market_state`, `trade_thesis`, `entry_trigger`,
`location_tags`, `location_decision`, and `reversal_confirmation`. `setup`, `market_context`, and `is_unconfirmed_reversal`
remain compatibility mirrors and are deprecated for new rules.

## Deduplication and suppression

Explicit `suppresses` is applied after matching. Within one `dedupe_group`, the
engine keeps higher severity, then higher priority, then deterministic rule ID
order. Use suppression only when two rules describe the same required action;
do not hide distinct actions.

## Next Actions And UI Hints

`next_actions` should tell the trader what to do next.

```yaml
next_actions:
  - Wait for follow-through or a structured retest.
  - Reduce urgency; do not chase the first breakout bar.
```

`ui_hints` is optional behavior metadata, but the field itself is required.
Use `{}` when no hints are needed.

```yaml
ui_hints:
  emphasis: acknowledgement_required
  required_action: Set runner stop.
```

## Acknowledgement

Use `requires_acknowledgement: true` when the UI should require conscious
warning acknowledgement before creating the plan.

Pre-trade acknowledgement remains separate from Stage 28 open-warning
dismissal. A dismissal must never bypass plan acknowledgement.

## Required Tests

When adding a new rule, add tests that cover:

- The rule triggers when its facts are present.
- The rule does not trigger when its facts are absent.
- The expected severity appears.
- `requires_acknowledgement` behavior is correct for warnings.
- The full YAML file still validates through `load_rules()`.
