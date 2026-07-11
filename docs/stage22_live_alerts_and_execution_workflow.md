# Stage 22: live alerts and execution workflow

Stage 22 keeps the product manual and discipline-focused. Official horizons are
`intraday`, `swing`, `leap`, and `other`. It never places or modifies broker orders.

## Email price alerts

Open trades are evaluated at Target 1, optional Target 2, and the active stop
(`current_stop`, falling back to `stop_loss`). Long targets cross upward and long
stops downward; short comparisons are reversed. Manual price patches, market
refreshes, and monitor cycles use the same backend service.

Each reached price creates one database event keyed by trade ID and its two-decimal
threshold. A unique constraint makes polling and restarts idempotent. Equal target
prices produce one event. Failed sends reuse the event on later monitor cycles, up
to `PRICE_ALERT_RETRY_LIMIT` (default 3); sent events never retry. Missing
configuration leaves events pending and does not crash the API.

Configure the variables in `.env.example`. Inspect `GET /notifications/status`
and test with `POST /notifications/test-email`. The backend/container must remain
running for alerts. The current deployment assumes one backend process.

Options use the underlying quote only. Unsupported markets retain manual prices.

## Execution-led closing

Every reduction posts price, quantity, and reason to the partial-exits endpoint.
Less than remaining records a partial; exactly remaining closes the local record;
more is rejected. Final R is quantity-weighted across every execution. The explicit
close endpoint remains for recovery and compatibility.

## Click-first planning and options

New Trade has Instrument & Horizon, Setup & Context, and Risk & Discipline steps.
Pressed buttons replace repeated dropdowns. The 200ms transition respects reduced
motion. Options select call/put, a suggested expiration, and strikes around the
fetched underlying quote. Suggestions are not a verified chain; holiday dates and
listed strikes must be verified in the broker. Option entry/current/exit premiums
are entered manually for P&L; no live premiums, Greeks, bid/ask, listing
validation, or broker actions are claimed.

## Deferred

Dedicated/distributed workers, coordination beyond database dedupe, SMS/push,
live option chains, broker execution/order changes, automatic broker closing, and
persistent warning acknowledgement remain deferred.
