# Stage 16 - Options Details and Price Lookup

## Numeric precision

Trade planning inputs use two-decimal precision for:

- Planned entry
- Stop loss
- Target 1
- Target 2
- Position size

The frontend formats values on blur and before submit. The backend also rounds accepted trade numeric fields to two decimals before persistence.

## Options trade fields

For options trades:

- `symbol` means the underlying ticker, such as `AAPL`, `TSLA`, `SPY`, or `QQQ`.
- `option_contract` stores the exact contract, such as `AAPL 2026-01-16 200C`.

Missing `option_contract` is a warning that requires acknowledgement. It is not a blocker in Stage 16.

## Price lookup

The New Trade form can fetch a quote by symbol through:

```text
GET /market-data/quote?symbol=AAPL
```

For stock trades, the UI labels this as `Last price`.

For options trades, the UI labels this as `Underlying price`. This is not an option premium and should not be used as the option entry price.

## Deferred

- Live option chain integration.
- Option premium quotes.
- Bid/ask and spread.
- Greeks, IV, delta, and option pricing models.
- Broker integration.
- Automatic order execution.
