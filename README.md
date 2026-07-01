# Trading Discipline Copilot

Trading Discipline Copilot is a local web app for following a manual trading process:

1. Complete a pre-trade checklist.
2. Manage an open trade with discipline reminders.
3. Review the trade after exit.
4. Summarize daily discipline.

It is **not** an auto-trading bot, does not execute orders, and does not predict markets.

## Project status

Stage 0 is complete: the repository structure and project documents are in place. Backend and frontend runtime code will be added in later stages, so the app is not runnable yet.

## Structure

```text
backend/   FastAPI backend (starting in Stage 1)
docs/      Product design, implementation plan, workflow, and learning log
frontend/  React + TypeScript frontend (starting in Stage 4)
```

## Planned local development

After the relevant stages are implemented, the backend will run with:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The frontend will run with:

```bash
cd frontend
npm install
npm run dev
```

These commands are documented now for orientation; their dependencies and source files intentionally arrive in later stages.

## Development approach

Work proceeds one stage at a time following [the implementation plan](docs/codex_implementation_plan.md). Each stage stays small, adds appropriate tests, updates the learning log, and leaves the project runnable when application code exists.
