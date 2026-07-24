# Stage 29: Position scaling and horizon management

Stage 29 adds two explicit management actions without broker integration:

1. Change a planned/open trade between Intraday, Swing, LEAP, and Other.
2. Record a local add execution for an already-open position.

## Horizon changes

The dedicated horizon endpoint accepts only planned/open trades, records
`trade_horizon_changed` with old/new values and status, and leaves price,
targets, stops, and executions unchanged. Analytics/filtering reads the latest
horizon; WorkflowEvent retains history. Reclassifying an open trade to intraday
shows readiness information but never invokes the plan-creation readiness gate.

## Add workflow

The collapsed Open Trades form suggests current underlying price and current
stop but never submits automatically. A live preview shows quantity, weighted
entry, incremental risk, total risk, remaining quantity, and Current Underlying
R. Confirmation records a local fact and clearly states that no broker order
was placed.

Adds require an open trade, current stop, positive bounded values, and a
directionally valid stop. Unconfirmed reversals are blocked. Adding below zero
aggregate Underlying R requires acknowledgement for that submission even if an
Attention warning was previously dismissed.

## Compatibility

Migration `0016` backfills one initial entry for eligible open/closed legacy
trades. Planned trades wait until opening. Null-size or unusable legacy records
remain recoverable and are not assigned invented quantities.
