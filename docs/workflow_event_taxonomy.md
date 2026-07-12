# Workflow Event Taxonomy

`WorkflowEvent` is append-only and supports future discipline analytics. Current trade/readiness/review tables remain authoritative.

## Fields

Events include type, optional trade ID/readiness date/rule/severity/idempotency key, allow-listed JSON data, occurrence time, and creation time. Trade deletion sets the event trade reference to null rather than deleting unrelated audit history.

## Events

- `readiness_saved`: required completion counts and cleared state.
- `plan_blocked`: explicit blocked user attempt, rule IDs and severity counts.
- `plan_warning_detected`: explicit warning-stage creation attempt, idempotent per planning session.
- `plan_created`: market, horizon, and setup.
- `trade_opened`: authoritative underlying entry.
- `trade_updated`: names of changed fields, not full values or notes.
- `partial_exit_recorded`: underlying execution price, quantity, and reason.
- `trade_auto_closed`: exit reason and Final underlying R.
- `trade_manually_closed`: exit reason and Final underlying R.
- `review_created`: score, classification, and plan-following result.
- `notification_email_sent`: alert kind and attempt count.
- `notification_email_failed`: alert kind, attempt count, and exception type only.

## Transaction policy

Readiness, plan, trade, exit, close, and review events share the domain transaction. An audit write failure rolls back that domain mutation because these events describe critical persisted transitions.

Email outcome events are appended after SMTP returns or raises and are committed with the durable alert-event delivery status. The delivery failure itself does not roll back threshold detection.

Planning events are written only for explicit user attempts carrying a planning-session ID and idempotency key. Debounced rule evaluation never writes events.

## Safety

Never store SMTP passwords, provider keys, raw credentials, full notes, full request bodies, or stack traces. The development endpoint supports event type, trade, date range, limit, and offset filters and is intentionally absent from main navigation.
