# Stage 24 — Attention Center and Manage-to-Review Workflow

## Purpose

Stage 24 consolidates unresolved operational work and completes the local workflow from trade management through exit and post-trade review.

## Attention model

`GET /attention` returns stable normalized items with source, severity, title, message, required action, optional trade identity, horizon, current underlying R, detection time, destination, and context. The response includes severity counts and total actionable count.

Only unresolved work is included. Allowed trades, inactive rules, sent email history, motivational copy, and open trades with no action are excluded. Items sort by blocker, warning, reminder; time-sensitive work comes first within severity, followed by newest detection time and deterministic ID.

Supported sources include trade rules, missing size/stop, runner protection, profit milestone, green-to-red, stale price, failed email, pending review, and notification configuration.

## Shared UI and navigation

Attention Center is a dedicated operational page; navigation does not show a count and Dashboard does not duplicate its items. Severity and official-horizon filters are supported. The empty state states only that no action is currently required and recommends continued monitoring.

Hash query context retains destinations after reload:

- `#open-trades?trade_id=123`
- `#post-trade-review?trade_id=123`
- `#dashboard?focus=notifications`
- `#open-trades?trade_id=123&section=price-alerts`

Invalid IDs produce an inline message. Valid targets expand and scroll into view; reviewed targets remain viewable and identify their completed status.

## Manage to review

Runner stop uses the common inline metric interaction. Runner state has one context-aware local-record action and never implies broker execution. Each open trade contains collapsed threshold-alert history and a compact execution preview. A full-position exit notice exposes symbol, trade ID, Final underlying R, exit reason, and a Review This Trade link.

## Boundaries

Open Trades retains RuleAlertPanel. Option R remains based exclusively on underlying entry, stop, current, target, and exit values. OptionContractSelector, Dashboard Daily Readiness placement, and Rules Library are unchanged. No broker integration or automatic order execution is introduced.

## Manual verification

1. Open Attention and confirm allowed open trades are absent.
2. Trigger a runner warning and verify it appears in Attention, then resolve it and confirm it disappears.
3. Filter by severity and each official horizon.
4. Reload an open-trade and review deep link and confirm the exact trade opens.
5. Expand Price Alert History and verify sent/pending/failed states and attempts.
6. Record partial executions and verify remaining quantity in Execution Preview.
7. Complete a full exit, choose Review This Trade, and confirm the exact review opens.
8. Save the review and verify the pending-review item disappears.
