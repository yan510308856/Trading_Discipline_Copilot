# Trading Discipline Copilot

Trading Discipline Copilot is a local web application for supporting a manual,
rules-based live trading discipline process. It helps you:

1. Validate a trade plan before entry.
2. Manage an open trade with discipline reminders.
3. Review execution quality after exit.
4. Track daily R, discipline scores, mistakes, and lessons.

It is **not** an auto-trading bot. It does not connect to a broker, place orders,
or predict market direction.
It is not a practice-mode simulator; blockers are part of the real workflow.

## Features

- Pre-trade form with blocker, warning, and reminder rules loaded from YAML.
- Required trade horizon classification: intraday, swing, leap, or other.
- Intraday trade plans are blocked until today's Daily Readiness checklist is cleared.
- Planned and open trade lifecycle stored in SQLite.
- Open-trade R tracking, stop management, partial-profit recording, and runners.
- Durable price-threshold email alerts and execution-based automatic local closing.
- Three-step click-first planning with structured option contract suggestions.
- Optional Finnhub quotes for open US stock positions; the API key stays server-side.
- Post-trade discipline scoring with YAML-configured bonuses, penalties, and vetoes.
- Persistent post-trade history with date and review-status filters.
- Confirmed trade deletion with cascading cleanup of owned records.
- Dashboard and daily discipline summaries.
- Searchable rules library.
- FastAPI error envelopes, Alembic migrations, backend tests, and frontend tests.

Stage 10 CSV import was intentionally skipped. There is no CSV or broker import
workflow in the current MVP.

## Quick start with Docker

Prerequisite: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
or another installation that provides Docker Compose.

From the repository root:

```bash
cp .env.example .env
# Edit .env and set FINNHUB_API_KEY. Never commit that file.
docker compose up --build
```

Open:

- Application: <http://localhost:3000>
- Backend API documentation: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

The backend automatically runs `alembic upgrade head` before it starts. SQLite
data is kept in the named Docker volume `trading_data`, so it survives container
restarts.

Email and polling are disabled by default. Configure the Stage 22 variables in
`.env.example`, then enable them. The backend/container must remain running for
background alerts; SMTP secrets are runtime-only and never returned by the API.

Back up the live Docker database without stopping the application:

```bash
scripts/backup-database.sh
```

Restore a backup (the script first creates a safety backup of the current data):

```bash
scripts/restore-database.sh backups/trading_discipline-YYYYMMDD-HHMMSS.db
```

Stop the application:

```bash
docker compose down
```

Stop it and deliberately delete local Docker data:

```bash
docker compose down -v
```

## Local development without Docker

### Backend

Prerequisites: Python 3.10+ and `venv`.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The backend runs at <http://127.0.0.1:8000>.

### Frontend

Prerequisite: Node.js 20+.

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at <http://127.0.0.1:5173>. Vite proxies `/api` requests to
the FastAPI server.

## Tests and verification

Backend:

```bash
cd backend
source .venv/bin/activate
pytest -q
alembic current
```

Frontend:

```bash
cd frontend
npm test
npm run build
```

Docker configuration:

```bash
docker compose config
docker compose build
```

Tests use isolated temporary SQLite databases and do not modify
`backend/trading_discipline.db` or the Docker volume.

## Full workflow example

1. Open **Dashboard** and confirm the backend is connected.
2. Complete **Today's Intraday Readiness** at the bottom of the Dashboard before planning intraday trades.
3. Open **New Trade**.
4. Classify the plan as **Intraday**, **Swing**, **LEAP**, or **Other**.
5. Leave stop loss empty and confirm the plan is blocked.
6. Enter a structural stop loss.
7. Select the `breakout` setup without follow-through and inspect the warning.
8. Complete the required fields and create the planned trade.
9. Open **Open Trades** and mark the entry filled.
10. Enter a current price that reaches at least `1R`.
11. Confirm the partial-profit reminder appears.
12. Record partial profit, activate the runner, and give it a protective stop.
13. Record the exact remaining exit quantity to close the local trade automatically.
14. Open **Post-Trade Review**, expand the trade, and save a review.
15. Return to **Dashboard** and confirm the discipline score and R are included.

Example long trade:

```text
Symbol: ES
Trade horizon: intraday
Direction: long
Setup: breakout
Context: strong_trend
Entry: 5000
Stop: 4990
Target 1: 5010
Exit: 5020
```

The initial risk is 10 points. An exit at 5020 is therefore `+2R`.

## How data flows

```text
React form
  → typed API client
  → FastAPI route
  → service-layer business rules
  → SQLAlchemy model
  → SQLite

YAML rules
  → backend rule engine
  → API result
  → alerts and rules-library cards
```

The close-trade operation owns exit price, exit reason, close time, and Final R.
Post-trade review cannot overwrite those execution facts. Partial and final exits
are stored as execution records, and the backend calculates quantity-weighted
Final R and the discipline score.

`trade_horizon` is saved with the trade plan. The backend defaults older clients
to `intraday`, and `GET /trades` can filter by horizon when needed. Swing and
other trades are not blocked by the Daily Readiness gate because that checklist
is specifically for intraday preparation.

## Project structure

```text
backend/
  app/                  FastAPI routes, models, schemas, services, and YAML rules
  alembic/              Database migrations
  tests/                pytest API and service tests
  requirements-dev.txt Development and test dependencies
  Dockerfile
frontend/
  src/components/       React pages and reusable UI components
  src/utils/            Pure calculations, filters, and Vitest tests
  Dockerfile
  nginx.conf            Production static hosting and /api proxy
.github/workflows/      Automated tests, builds, and Docker verification
scripts/                SQLite backup and restore commands
docs/                   Product design, implementation plan, and learning log
docker-compose.yml      Local two-container application
```

## Important configuration

- Local database default: `backend/trading_discipline.db`
- Override database: set `DATABASE_URL`
- Price-action rules: `backend/app/rules/price_action_rules.yaml`
- Discipline scoring: `backend/app/rules/discipline_scoring_rules.yaml`
- Frontend API base: set `VITE_API_BASE_URL` when not using the default `/api`
- Finnhub quote key: set `FINNHUB_API_KEY` in the root `.env`; automatic quotes
  currently apply only to trades whose market is `stocks`.

## Known limitations

- No broker connection, order execution, or automated trading.
- No authentication or multi-user support; this is a local single-user tool.
- No CSV import because Stage 10 was skipped.
- Non-stock prices and all partial exits are entered manually.
- Weighted Final R requires position size when a trade has partial exits.
- SQLite timestamps are stored for the local MVP; timezone/reporting policy
  should be made explicit before multi-region deployment.

## Learning documents

- [Product design](docs/product_design.md)
- [Implementation plan](docs/codex_implementation_plan.md)
- [Engineering workflow](docs/engineering_workflow.md)
- [Learning log](docs/learning_log.md)
