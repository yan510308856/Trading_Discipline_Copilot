from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.main import app
from app.models import Trade
from app.schemas import TradeCreate
from app.services.trade_service import create_planned_trade


def test_health_check() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_migration_creates_core_tables(database_session: Session) -> None:
    table_names = set(inspect(database_session.bind).get_table_names())

    assert {"trades", "alerts", "reviews", "checklist_answers"} <= table_names
    assert "alembic_version" in table_names


def test_create_planned_trade(database_session: Session) -> None:
    trade_data = TradeCreate(
        symbol="ES",
        market="futures",
        direction="long",
        setup="breakout",
        market_context="strong_trend",
        planned_entry=5000,
        stop_loss=4990,
        target_1=5020,
        runner_enabled=True,
        position_size=1,
        risk_per_trade=10,
        notes="Wait for follow-through.",
    )

    trade = create_planned_trade(database_session, trade_data)
    stored_trade = database_session.scalar(select(Trade).where(Trade.id == trade.id))

    assert stored_trade is not None
    assert stored_trade.symbol == "ES"
    assert stored_trade.status == "planned"
    assert stored_trade.actual_entry is None
