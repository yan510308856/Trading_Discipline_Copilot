# Position accounting and aggregate Underlying R

## Execution facts

- **Initial entry:** the single entry created transactionally when a plan opens.
- **Add entry:** an immutable later increase in exposure.
- `TradeEntryExecution` stores entries; `TradeExecution` continues to store
  partial and final exits.
- `position_size` remains the initial planned/opened quantity.

## Quantity definitions

```text
initial quantity = quantity of the initial entry
added quantity = sum(add quantities)
total entered quantity = sum(all entry quantities)
total exited quantity = sum(all exit quantities)
remaining quantity = total entered quantity - total exited quantity
weighted average entry = Σ(entry price × entry quantity) / total entered quantity
```

Exit quantity cannot exceed remaining quantity. Automatic close occurs exactly
when total exited quantity equals total entered quantity.

## Risk

Each entry preserves its stop at entry:

```text
entry-leg underlying risk = abs(entry price - stop at entry) × entry quantity
total underlying risk = Σ(entry-leg underlying risk)
```

Option premiums are excluded.

## Aggregate R

For a long position:

```text
PnL = Σ(exit price × exit quantity)
    + current price × remaining quantity
    - Σ(entry price × entry quantity)
```

For a short position:

```text
PnL = Σ(entry price × entry quantity)
    - Σ(exit price × exit quantity)
    - current price × remaining quantity
```

Current Underlying R uses marked-to-market PnL. Final Underlying R uses fully
realized PnL after remaining quantity reaches zero:

```text
Underlying R = aggregate underlying PnL / total underlying risk
```

Options use the resolved underlying direction and underlying prices only.
Option-premium return, option PnL, and option-based R are not analytics.

## Decimal and migration policy

Backend aggregation converts stored values through `Decimal(str(value))`.
Quantities normalize to two decimals for comparison; calculations retain
precision and round only at API/output boundaries. A trade without entry
executions may use the legacy single-entry fallback. Migration backfills only
facts supported by existing entry, stop, and quantity data and never invents a
null quantity.
