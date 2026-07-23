# Discipline analytics definitions

Stage 26 measures whether the discipline workflow is being followed. It does not interpret profit as proof of a good process.

## API, filters, and time

`GET /analytics/discipline` accepts optional `date_from`, `date_to`, `trade_horizon`, `market`, `market_state`, `trade_thesis`, `entry_trigger`, `location_tag`, and deprecated `setup`. Dates are UTC calendar dates: `date_from` starts at 00:00 UTC and inclusive `date_to` ends immediately before 00:00 UTC the following day. Multiple filters use AND semantics.

Planning uses trade creation time, execution uses open time, review uses close time, notification uses threshold-trigger time, and WorkflowEvent metrics use occurrence time. Readiness uses its date-only `readiness_date`. Trade filters apply to trade-backed metrics; horizon, market, and setup do not alter readiness because readiness is not attached to a trade.

Rates return `null` when their denominator is zero. The UI says `No recorded data`; it never emits NaN or Infinity or represents missing evidence as 0%.

## Metric definitions

| Section | Metric | Numerator or value | Denominator |
| --- | --- | --- | --- |
| Preparation | Readiness days recorded | Persisted DailyReadiness rows | none |
| Preparation | Readiness days cleared | Recorded rows cleared for intraday | none |
| Preparation | Readiness completion rate | Cleared readiness days | Recorded readiness days |
| Preparation | Average required items completed | Sum of completed required-item counts | Recorded readiness days |
| Planning | Plans created | Trades created | none |
| Planning | Blocked plan attempts | `plan_blocked` WorkflowEvents | none |
| Planning | Warning finalization attempts | `plan_warning_detected` WorkflowEvents | none |
| Planning | Plans with valid stop | Plans with positive risk in intended underlying direction | All created plans |
| Planning | Plans with position size | Plans with positive position size | All created plans |
| Planning | Average planned risk/reward | Mean Target 1 reward / underlying risk | Valid plans with positive reward |
| Planning | Average total planned risk | Mean underlying risk per unit × size | Valid plans with positive size |
| Execution | Trades opened | Trades opened in period | none |
| Execution | Partial exit rate | Opened trades with a partial execution | All opened trades |
| Execution | Runner activations | Distinct trades with audited runner activation | none |
| Execution | Runner without stop | `runner_must_have_protection` alerts | none |
| Execution | Green-to-red warnings | `green_trade_should_not_go_red` alerts | none |
| Execution | Average exit executions | Exit execution records | Selected opened trades |
| Execution | Auto-closed trades | `trade_auto_closed` WorkflowEvents | none |
| Review | Closed trades | Trades closed in period | none |
| Review | Reviewed trades | Selected closed trades with Review | none |
| Review | Review completion rate | Reviewed closed trades | All closed trades |
| Review | Median review delay | Median non-negative close-to-review minutes | Reviewed closed trades |
| Review | Reviews within 24 hours | Reviews saved within 1,440 minutes | none |
| Review | Review within 24 hours rate | Reviews within 24 hours | Reviewed closed trades |
| Review | Pending reviews | Closed trades without Review | none |
| Notifications | Threshold events | Persisted Target 1, Target 2, and stop events | none |
| Notifications | Emails sent/failed | Events in each delivery state | none |
| Notifications | Email success rate | Sent attempted threshold events | Events with at least one attempt |
| Notifications | Retry exhausted | Unsent events at/above retry limit | none |
| Notifications | Latest failure | Latest update time among failed events | none |

Recurring mistake tags come from reviews; blocking and warning rule frequencies come from explicit plan-attempt events. The horizon breakdown combines those issues with runner-protection and green-to-red alerts and always includes intraday, swing, leap, and other.

## Underlying R

Total Underlying R, Average Underlying R, and Median Underlying R use stored final R for selected closed trades. For options, entry, stop, exit, and R use only the underlying symbol. Option premium return, option P&L, and option-based R are intentionally absent. Discipline score remains separate from outcome.

## Missing and legacy data

Unrecorded readiness days are not inferred because no exchange calendar exists. Runner activations before the enriched Stage 26 audit payload may be undercounted. This is preferred over guessing from final state.

## Deferred

- Exchange trading-day calendars and user-selectable timezones
- Reconstruction of pre-audit runner actions
- Broker execution-quality analytics
- Option premium return, P&L, Greeks, or option-based R
