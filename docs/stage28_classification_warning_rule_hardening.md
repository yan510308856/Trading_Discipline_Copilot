# Stage 28 — Classification, warning, and rule integrity

Stage 28 makes planning intent explicit and gives operational warnings a safe,
persistent dismissal lifecycle. It does not weaken pre-trade discipline gates.

## Preserved product decisions

- New Trade classification is bilingual.
- Planned and open trade cards are intentionally English-only.
- Market State, Trade Thesis, and Entry Trigger require two deliberate normal
  clicks. The second click confirms, then the next stage appears after about
  350 ms.
- Daily Readiness remains at the bottom of Dashboard.
- Options R uses underlying prices only. There is no premium return, option
  P&L, option-based R, broker integration, or automatic execution.

## Explicit classification decisions

`location_decision` is `selected`, `none`, or null. `selected` requires at least
one tag. `none` requires an empty tag list. Null means undecided or a legacy
record whose intent is unknown. Removing the final selected tag returns the New
Trade draft to undecided; empty tags never silently select “No key location.”

`reversal_confirmation` is `confirmed`, `unconfirmed`, or null. Major reversals
require an explicit answer. Other theses normalize it to null.
`is_unconfirmed_reversal` remains a deprecated compatibility mirror.

The unchanged `OptionContractSelector` now appears in Instrument & Horizon.
Options must have type, expiration, and strike before Price Action begins.

## Warning dismissal lifecycle

Only active `warning` items in Open Trades and Attention are dismissible.
Blockers, reminders, validation errors, and pre-trade warning gates are not.
Dismissal hides one occurrence; it does not change trade facts, YAML rules,
email delivery state, or acknowledgement requirements.

`POST /warning-dismissals` validates the supplied key against the current active
dismissible set. `DELETE /warning-dismissals/{dismissal_key}` supports Undo.
The UI hides immediately, restores on mutation failure, and offers temporary
Undo.

Rule warning identity hashes trade ID, rule ID, severity, trigger values,
matched condition values, and the latest audit event that changed a
rule-relevant field. Notes and unrelated edits do not recreate a warning.
Relevant fact changes or an inactive-to-active cycle produce a new occurrence.
Failed emails use the alert-event ID. Notification configuration uses a
secret-free state fingerprint.

Stale price remains visible through `PriceFreshness`, source, and update time,
but is informational: it creates no warning, Attention item, count, gate, or
warning occurrence.

## Rule precision

Rules may declare `priority`, `dedupe_group`, and `suppresses`. Explicit
suppression runs first. A dedupe group then keeps higher severity, higher
priority, and finally lexicographically smaller rule ID.

The breakout-mode warning suppresses the generic follow-through warning. The
options unconfirmed-reversal blocker suppresses the lower-severity strong-trend
warning. The prior-day failed-breakout warning now requires prior-day high or
low. Gap-open copy no longer claims that a retest or breakout gap is known.
Intentionally disabled notifications are neutral; enabled-but-incomplete,
expected-but-stopped, and individual failed email events remain warnings.

## Taxonomy and compatibility

`shared/price_action_taxonomy.json` is the canonical label/order contract.
Frontend code imports it while retaining TypeScript unions. Backend Pydantic
Literals remain strict and contract tests assert exact values and order.

`setup` and `market_context` remain response mirrors. Structured fields are the
writable source of truth; contradictory legacy patches return
`409 LEGACY_CLASSIFICATION_READ_ONLY`.

Migration `0015_stage28_warning_integrity` adds the decision columns and
`warning_dismissals`. Non-empty historical tags backfill to `selected`; empty
tags stay null. Legacy `is_unconfirmed_reversal=true` backfills to
`unconfirmed`; false never becomes confirmed.
