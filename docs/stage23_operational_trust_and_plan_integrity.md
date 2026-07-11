# Stage 23 — Operational Trust and Complete Trade Planning

Stage 23 makes system reliability visible and requires enough information to validate total planned risk before a new trade is created.

## Notification health

`GET /notifications/status` reports email enablement, recipient and SMTP configuration, provider, monitor configuration, actual monitor runtime state, poll interval, last monitor cycle, last successful price refresh, last monitor error, and the latest persisted alert-email result. It never returns SMTP passwords, usernames, API keys, or credentials.

Monitor runtime fields are module-level state for the supported local single-process deployment. They reset after every backend restart and remain empty until the relevant activity occurs. Persisted `TradePriceAlertEvent` rows remain the source for the latest email outcome.

## Price provenance and freshness

`Trade.current_price_source` and `Trade.current_price_updated_at` are nullable additive fields. Provider refreshes store the provider name and quote timestamp (or fetch time). Manual current-price patches store `manual` and server time. Automatic quotes older than 120 seconds are stale in the UI.

For options, the monitor requests the underlying symbol as a stock quote and stores it in `Trade.current_price`. Threshold alerts and every R calculation continue to use underlying prices only. There is no premium return, option P&L, option-based R, option-chain validation, bid/ask, or Greeks.

## Complete plan validation

New trade creation requires a positive position size at the API and in the wizard. The database stays nullable so legacy rows remain readable and patchable. Step 3 shows risk per unit, size, total planned risk, Target 1 R, optional Target 2 R, decision status, required action, alerts, and acknowledgement state. Steps 2 and 3 retain a compact verification summary, and final confirmation exposes the complete plan and warnings.

Blocked, unacknowledged-warning, invalid-risk, missing-size, and incomplete intraday-readiness states cannot be bypassed by final confirmation. Disabled actions always explain the active reason.

## Preserved boundaries

OptionContractSelector layout and interaction, Rule Alerts, and the Dashboard’s bottom Daily Readiness panel are unchanged. There is no broker integration, automatic order execution, distributed worker, SMS, or push notification support.

## Manual verification

1. Configure email and monitor environment values, start the backend, and confirm Dashboard status becomes Running/Active after a cycle.
2. Send a test email and verify success and failure feedback.
3. Open a stock and an option trade, refresh prices, and verify provider/freshness metadata; confirm the option label says Underlying price.
4. Manually edit current price and verify the metadata changes to Manual.
5. Build a new option plan and confirm a complete structured contract does not raise the missing-contract warning.
6. Confirm creation stays disabled without positive size and displays total planned risk after size is supplied.
7. Verify the final dialog includes stop, total risk, decision state, and warning messages.
