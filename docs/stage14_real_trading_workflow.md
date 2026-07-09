# Stage 14 - Real Trading Workflow

## What changed

Stage 14 hardens Trading Discipline Copilot for real trading discipline support:

- Rule alerts can now include `next_actions`, `ui_hints`, and `requires_acknowledgement`.
- Warning-level pre-trade plans require explicit acknowledgement before creation.
- Blocker rules still block unsafe trade plan creation.
- Left-side bottom picking with options is blocked.
- Left-side bottom picking with stocks warns and requires small-size confirmation.
- Open trade cards show a top-level Required Action area.

## Why Practice Mode was rejected

Practice Mode and Learning Mode were rejected because this tool is designed around real trading discipline. A separate mode could imply that blocker rules are optional or softer in some contexts. Stage 14 keeps one workflow so the safety rules stay clear.

## How live discipline mode works

```text
Plan -> Execute -> Manage -> Review
```

- Plan: create a trade plan only after blocker and warning checks.
- Execute: the user places any order outside this app.
- Manage: record current price, stops, partial profits, and runner protection.
- Review: score discipline after the trade is closed.

Rule behavior:

- Blocker: must be fixed before a trade plan can be created.
- Warning: requires conscious acknowledgement before a trade plan can be created.
- Reminder: highlights a management action without placing or changing orders.

## Deferred

- Broker integration.
- Auto trading.
- Order placement, modification, or cancellation.
- Authentication.
- Full UI redesign.
- New database fields for instrument type.
