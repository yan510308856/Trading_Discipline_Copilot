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
