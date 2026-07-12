# Learning Log

## Stage 0 - Project initialization and documentation

### Date

2026-07-01

### What changed

- Created separate `backend/`, `frontend/`, and `docs/` areas.
- Placed the product, implementation, and engineering guides in `docs/`.
- Added project purpose, scope boundaries, and planned run commands to the README.
- Added minimal backend and frontend manifests without introducing runtime code.

### Commands I ran

```bash
rg --files
```

### Tests

No application tests apply yet because Stage 0 contains documentation and structure only. File layout and copied documents were verified instead.

### Engineering concepts learned

- A predictable project root makes tools and documentation easier to find.
- Separating frontend, backend, and documentation prevents unrelated concerns from becoming tangled.
- A staged plan controls scope and keeps changes reviewable.

### Trading discipline concepts encoded

The project boundary is explicit: this app supports manual checklists, trade management, review, and summaries; it never executes trades.

### Bugs / debugging notes

The source documents initially lived at the project root rather than in `docs/`. Stage 0 preserves those originals and adds the planned copies.

### Next stage

Stage 1 will add the FastAPI foundation, SQLAlchemy models, SQLite persistence, Alembic migrations, and a minimal database test.

## Stage 1 - Backend models and SQLite persistence

### Date

2026-07-01

### What changed

- Added a minimal FastAPI application with a health endpoint.
- Defined SQLAlchemy models for trades, alerts, reviews, and checklist answers.
- Added Pydantic schemas to validate service-layer inputs and outputs.
- Configured local SQLite sessions and Alembic migrations.
- Added a service that persists a new trade in the `planned` state.

### Commands I ran

```bash
cd backend
alembic upgrade head
pytest
```

### Tests

- Health endpoint returns an OK response.
- Initial migration creates all four domain tables and Alembic metadata.
- Trade service persists and reloads a planned trade.

### Engineering concepts learned

- SQLAlchemy models describe storage; Pydantic schemas validate data crossing boundaries.
- A database session groups persistence work into a transaction.
- Alembic migrations version the schema instead of silently rebuilding it at startup.
- A service keeps business operations separate from HTTP routes.

### Trading discipline concepts encoded

A trade begins as a plan. Alerts, checklist answers, and a review belong to that trade record, creating the foundation for the full discipline lifecycle.

### Bugs / debugging notes

The migration test uses an isolated temporary SQLite file, so tests never modify the developer's local database.

### Next stage

Stage 2 will encode selected discipline rules in YAML and evaluate them with a tested rule engine.

## Stage 2 - YAML rules and rule engine

### Date

2026-07-02

### What changed

- Encoded the first price-action discipline rules in YAML.
- Added a service that evaluates rule triggers and conditions.
- Tested blocker, warning, reminder, and comparison behavior.

### What I learned

- Configuration-driven rules can change without rewriting UI or service code.
- A rule engine separates facts about a trade from decisions about those facts.
- Blockers, warnings, and reminders need different product behavior.

## Stage 3 - API contracts and error envelopes

### Date

2026-07-03

### What changed

- Added trade lifecycle, rule evaluation, review, and summary API contracts.
- Standardized validation and business errors as `{code, message, details}`.
- Added API-level tests with isolated migrated databases.

### What I learned

- Stable request and response schemas are the contract between frontend and backend.
- HTTP status codes describe the class of failure; application error codes describe the exact failure.

## Stage 4 - React application shell

### Date

2026-07-03

### What changed

- Added the React, TypeScript, and Vite application shell.
- Added navigation, shared visual styles, and a typed API client.
- Connected the Dashboard health indicator to FastAPI.

### What I learned

- TypeScript types prevent many frontend/backend mismatches before runtime.
- Vite's development proxy lets the frontend call `/api` without local CORS complexity.

## Stage 5 - Pre-trade checklist

### Date

2026-07-04

### What changed

- Built the planned-trade form and risk/reward preview.
- Combined local form validation with backend YAML rule evaluation.
- Added blocker and warning states before trade creation.

### What I learned

- Client validation improves feedback, but backend validation remains authoritative.
- Debounced rule evaluation avoids sending a request for every keystroke immediately.

## Stage 6 - Open-trade management

### Date

2026-07-05

### What changed

- Added planned-to-open and open-to-closed lifecycle actions.
- Added current R, price ladder, partial-profit quantity, runner, stop, and note controls.
- Added lifecycle timestamps and automatic Final R calculation.

### What I learned

- State transitions belong in service functions, not arbitrary field patches.
- Derived values such as R should be calculated from persisted facts rather than manually entered.

## Stage 7 - Post-trade review and discipline scoring

### Date

2026-07-06

### What changed

- Added YAML-configured discipline scoring, penalties, bonuses, score bands, and veto rules.
- Added persistent reviews with mistake tags, positive actions, lessons, and classifications.
- Kept reviewed trades visible in a filterable, chronological history.

### What I learned

- Process quality and financial outcome are separate dimensions.
- Veto rules model non-negotiable risk boundaries better than large linear penalties.
- The backend must calculate discipline scores so clients cannot submit their own result.

## Stage 8 - Dashboard and daily summary

### Date

2026-07-07

### What changed

- Aggregated daily trades, net R, discipline scores, violations, mistakes, and lessons.
- Added Dashboard metric cards and a date-selectable Daily Summary page.
- Added explicit loading, error, and empty states.

### What I learned

- Aggregation converts individual records into feedback about repeated behavior.
- JSON mistake tags are simple to aggregate in Python for a local MVP.

## Stage 9 - Rules library

### Date

2026-07-08

### What changed

- Added a typed rules API response and completed `avoid` guidance in YAML.
- Added searchable rule cards with stage, severity, and category filters.
- Tested combined filter and case-insensitive search behavior.

### What I learned

- A data-driven UI renders knowledge from one source instead of duplicating it in React.
- Pure filter functions are easier to test than logic embedded throughout a component.

## Stage 10 - CSV import

### Date

2026-07-08

### Status

Intentionally skipped. The MVP has no CSV import, broker integration, or automated order workflow.

## Stage 11 - Polish, tests, documentation, and Docker

### Date

2026-07-08

### What changed

- Replaced the Stage 0 README with complete Docker and local-development instructions.
- Added a Docker Compose stack with FastAPI, persistent SQLite storage, Nginx, and the production frontend build.
- Audited loading, error, and empty states across data-driven pages.
- Added a full lifecycle integration test and verified the complete MVP workflow.

### Engineering concepts learned

- Delivery includes repeatable setup, migrations, tests, documentation, and operational boundaries.
- Docker images package runtimes; Compose connects services and persistent storage.
- An end-to-end integration test protects the seams between otherwise well-tested features.

### Known limitations

- The app remains local and single-user.
- Market prices, partial exits, and reviews are manually entered.
- No CSV import, broker connection, authentication, or auto-trading is implemented.

## Stage 14 - Real trading workflow and live discipline hardening

### Date

2026-07-08

### What changed

- Clarified that Trading Discipline Copilot supports real trading discipline, not Practice Mode or Learning Mode.
- Added actionable rule metadata: `next_actions`, `ui_hints`, and `requires_acknowledgement`.
- Added left-side bottom-picking rules: options are blocked, stocks require small-size warning acknowledgement.
- Required explicit warning acknowledgement before a warning-level trade plan can be created.
- Added a Required Action area to open trade cards.

### Commands I ran

```bash
backend/.venv/bin/pytest backend/tests/test_rule_engine.py -q
cd frontend
npm test
npm run build
```

### Tests

- Rule engine tests cover missing stop loss, breakout without follow-through, left-side options blocker, left-side stock warning, and legacy rules without new metadata.
- Frontend unit tests and production build pass.

### Engineering concepts learned

- Additive schema changes let old configuration keep working while new UI behavior becomes possible.
- Warning acknowledgement is a product safety gate, not just a visual message.
- Small UI hardening can improve real workflow safety without a full redesign.

### Trading discipline concepts encoded

Blockers are hard stops. Warnings slow the trader down and require conscious acceptance. Reminders point to required management actions while leaving the trading decision with the human.

## Stage 15 - Daily intraday readiness checklist

### Date

2026-07-09

### What changed

- Added a persisted daily intraday readiness checklist.
- Added required preparation items for watchlist, market environment, scheduled risks, swing position review, and risk limits.
- Added optional preparation items for platform readiness, mental state, and no-forced-trade confirmation.
- Added a Dashboard panel that shows Not cleared / Partially ready / Cleared status.
- Added a New Trade banner when intraday readiness is incomplete.

### Commands I ran

```bash
cd backend
.venv/bin/pytest -q

cd frontend
npm test
npm run build
```

### Tests

- Backend tests cover default checklist creation, required count calculation, cleared/not-cleared status, persistence, today's endpoint, and unknown item error envelopes.
- Frontend tests cover readiness copy and progress helpers.

### Engineering concepts learned

- A JSON checklist field is useful when the item template may evolve and does not need complex querying yet.
- Service-layer calculations keep route handlers simple and make business rules easier to test.
- A small migration is the safe way to evolve SQLite without deleting local data.

### Trading discipline concepts encoded

Intraday trading starts with daily preparation, not with the first chart that looks interesting. Readiness is a permission gate for planning intraday trades, while existing swing/open position management remains allowed.

### Known limitations

- Economic events, watchlists, and market environment are entered manually.
- No automatic event calendar, watchlist generation, market classification, broker integration, or order execution is implemented.
- Strict `trade_horizon` gating is deferred in Stage 15 and resolved in Stage 17.

## Stage 16 - Decimal precision, options details, and symbol price lookup

### Date

2026-07-09

### What changed

- Numeric trade inputs now use two-decimal behavior.
- Added `option_contract` for options trades.
- Added an options warning when the exact contract is missing.
- Added symbol quote lookup for a reference underlying/last price.
- Kept option premium entry, stop, and targets manual.

### Commands I ran

```bash
cd backend
.venv/bin/pytest -q

cd frontend
npm test
npm run build
```

### Tests

- Backend tests cover option contract persistence, missing-contract warning, quote lookup, unavailable quote fallback, and existing lifecycle behavior.
- Frontend tests cover decimal parsing/formatting and rounded risk calculations.

### Engineering concepts learned

- Decimal normalization belongs at both edges: frontend before submit and backend schemas before persistence.
- A nullable model field plus a migration is the smallest durable way to add optional domain data.
- Quote lookup should return an explicit unavailable state instead of crashing when a provider is not configured.

### Trading discipline concepts encoded

For options, the underlying ticker is not enough. The exact expiration, strike, and call/put direction must be recorded so the trade plan matches the instrument actually being traded.

### Known limitations

- Underlying quote lookup does not provide option premium.
- No option chain, bid/ask spread, Greeks, implied volatility, pricing model, broker integration, or auto-trading is implemented.

## Stage 17 - Trade horizon, intraday gate, and navigation scanability

### Date

2026-07-09

### What changed

- Added `trade_horizon` for `intraday`, `swing`, and `other` trade plans.
- Intraday plans are blocked when today's Daily Readiness is incomplete.
- Swing and other plans are not blocked by Daily Readiness.
- Daily Readiness intentionally remains at the bottom of Dashboard.
- Navigation now uses simple icons plus readable labels instead of single-letter initials.

### Commands to run

```bash
cd backend
pytest -q

cd frontend
npm test
npm run build
```

### Tests

- Backend tests cover horizon persistence, defaulting, filtering, and invalid values.
- Frontend tests cover the horizon selector, default intraday value, readiness gate behavior, and navigation scanability.

### Engineering concepts learned

- A persisted product concept needs a database migration, backend schema, API contract, frontend type, UI field, and tests.
- Optional query parameters add filtering without creating new endpoints.
- Pure utility functions make frontend business rules testable without a browser test runner.

### Trading discipline concepts encoded

Intraday trades need same-day preparation before planning. Swing and other trades may still require discipline, but they should not be blocked by an intraday-specific readiness checklist.

### Known limitations

- No broker integration, order execution, or auto trading is implemented.
- No option premium, option chain, Greeks, or bid/ask spread support is added.
- Trade horizon is used for planning gates and API filtering, not yet for analytics.

## Stage 18 - Trade horizon filters and cockpit metrics layout

### Date

2026-07-09

### What changed

- Added `trade_horizon` filtering to the daily summary API.
- Added reusable frontend horizon filtering for operational screens.
- Applied horizon filters to Open Trades, Post-Trade Review, Daily Summary, and Dashboard summary.
- Tightened touched metric layouts with smaller labels, larger tabular values, and less decorative spacing.
- Added inline edits for open-trade Target 1, Target 2, and Position size metrics.
- Added recorded partial exits to the price map.
- Removed the stop-to-breakeven shortcut from open-trade management.
- Kept Daily Readiness at the bottom of Dashboard by product choice.

### Commands to run

```bash
cd backend
pytest -q

cd frontend
npm test
npm run build
```

### Tests

- Backend tests cover daily summary all/intraday/swing horizon filtering and invalid horizon validation.
- Frontend tests cover horizon filter rendering, API query parameters, and summary metric rendering.

### Engineering concepts learned

- A filter dimension should be represented consistently in API query params, typed clients, hooks, and screen state.
- Keeping filter state local is enough when the same filter does not need cross-page persistence yet.
- Cockpit UI work is often about hierarchy and scanability, not a large redesign.

### Trading discipline concepts encoded

Different trade horizons should be separable during management and review. Intraday, swing, and other trades can have different preparation quality and mistakes, so filtering helps review the correct behavior set.

### Known limitations

- Horizon filters are local to each screen and are not persisted.
- No new broker, quote, or options premium behavior is introduced.
- No cross-horizon analytics dashboard is implemented.

## Stage 19 - Rule engine schema validation

### Date

2026-07-09

### What changed

- Added a Pydantic schema for price-action rule YAML.
- `load_rules()` now validates YAML before returning rule dictionaries.
- Existing price-action rules now include the full explicit metadata contract.
- Added `docs/rule_authoring_guide.md`.

### Commands to run

```bash
cd backend
pytest -q

cd frontend
npm test
npm run build
```

### Tests

- Backend tests cover current YAML validation, missing top-level `rules`, unsupported operators, invalid severity, missing `compare_field`, and invalid `in` values.

### Engineering concepts learned

- Configuration files need tests when they drive business behavior.
- Pydantic is useful for validating both API payloads and internal YAML assets.
- Operator-specific validation catches authoring mistakes before runtime.

### Trading discipline concepts encoded

Rules are safety boundaries, not decorative copy. Validating the rule file protects the discipline workflow from silent YAML mistakes.

### Known limitations

- Persistent warning acknowledgement is still deferred.
- No new trading rules were added.
- The validation currently targets price-action rules, not the scoring YAML.

## Stage 20 - Backend router split

### Date

2026-07-09

### What changed

- Split backend routes into domain modules under `backend/app/api/`.
- Kept `app.main` including a single combined `app.api.router`.
- Preserved existing endpoint paths and response models.
- Left service-layer business behavior unchanged.

### Commands to run

```bash
cd backend
pytest -q

cd frontend
npm test
npm run build
```

### Tests

- Existing backend API tests verify route behavior is unchanged.
- Frontend tests and build verify API client expectations still compile and run.

### Engineering concepts learned

- Route layers translate HTTP requests into service calls.
- Service layers contain business behavior and should not be rewritten during a router split.
- Refactors should be behavior-preserving and proven by existing tests.

### Trading discipline concepts encoded

No trading behavior changed. This stage improves maintainability so future readiness, trade, rule, review, and summary work has clearer ownership.

### Known limitations

- No product features were added.
- Persistent warning acknowledgement remains deferred.
- No broker integration or options behavior changes were introduced.

## Stage 21 - Frontend server state and small UI primitives

### Date

2026-07-09

### What changed

- Added TanStack Query and wrapped the app in `QueryClientProvider`.
- Added query hooks for daily summary, readiness, trades, rules, and open attention.
- Added mutation hooks for common write paths with related query invalidation.
- Refactored Dashboard summary, Daily Readiness, and shared trade-list loading onto query-backed state.
- Added small UI primitives: Button, StatusBadge, Panel, and Field.

### Commands to run

```bash
cd backend
pytest -q

cd frontend
npm test
npm run build
```

### Tests

- Frontend tests cover query provider setup, query keys, Dashboard loading state, and UI primitive rendering.
- Backend tests confirm no API behavior changed.

### Engineering concepts learned

- Server state is backend-owned API data that needs caching, loading/error state, and invalidation.
- Local UI state is temporary interaction state such as form drafts and filters.
- TanStack Query is better than Zustand for server data because it understands query keys, refetching, and mutation invalidation.
- UI primitives should start small and be used only where patterns are stable.

### Trading discipline concepts encoded

No trading behavior changed. This stage improves frontend maintainability so readiness, trades, summaries, and reviews can stay consistent as the workflow grows.

### Known limitations

- Not every API call is refactored yet.
- UI primitives are intentionally tiny and not a full design system.
- Persistent warning acknowledgement remains deferred.
# Stage 22 learning notes

- Lifespan-managed scheduling makes startup and shutdown explicit.
- Idempotency combines a normalized business key and a database unique constraint.
- An SMTP protocol isolates delivery and keeps tests away from real email.
- Execution-led lifecycle derives closure from cumulative quantity; weighted R uses every fill.
- Wizard state and accessible pressed buttons reduce repeated interaction.
- Additive nullable migrations preserve legacy option and execution records.
# Stage 23 learning notes

- “Configured” and “running” are different operational facts; trustworthy status must report both.
- Durable email outcomes belong in persisted alert events, while lightweight loop liveness can remain process-local for a single-process local app.
- Additive nullable columns preserve old data while API create validation can enforce stronger requirements for all new records.
- Option risk stays coherent when quote refresh, alerts, and R calculations all use the same underlying-price model.
## Stage 24 learning notes

- A useful attention feed is a projection of unresolved work, not a list of entities or historical events.
- Backend normalization keeps stale prices, failed delivery, and pending-review decisions consistent within the dedicated Attention workflow.
- Hash query context provides lightweight reload-safe deep links without introducing a routing dependency.
- State mutation and cache invalidation are one workflow concern: resolving a runner warning or review must update every Attention consumer.
## Stage 25 learning notes

- Copying query results into component state creates two authorities and timing bugs; controlled Query cache updates preserve a single owner.
- A composed mutation can represent partial success honestly: the trade exists even if secondary checklist persistence failed.
- Audit trails are most trustworthy when lifecycle events share the domain transaction.
- External side effects need outcome events after the attempt, while idempotency prevents retry noise.
- An audit log can support future analytics without turning the application into an event-sourced system.
