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
