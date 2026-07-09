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
- Strict `trade_horizon` gating is deferred.
