from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from app import models


def payload(**updates) -> dict:
    return {
        "symbol": "AAPL",
        "market": "stocks",
        "direction": "long",
        "trade_horizon": "swing",
        "market_state": "strong_trend",
        "trade_thesis": "pullback_continuation",
        "entry_trigger": "second_entry",
        "location_tags": ["support"],
        "location_decision": "selected",
        "planned_entry": 100,
        "stop_loss": 95,
        "target_1": 115,
        "position_size": 2,
    } | updates


def create_and_open(client: TestClient, **updates) -> dict:
    created = client.post("/trades", json=payload(**updates))
    assert created.status_code == 201, created.text
    opened = client.post(f"/trades/{created.json()['id']}/open", json={})
    assert opened.status_code == 200, opened.text
    return opened.json()


def add_payload(**updates) -> dict:
    return {
        "underlying_price": 110,
        "quantity": 1,
        "stop_at_entry": 100,
        "reason": "breakout_confirmation",
    } | updates


def test_horizon_change_is_explicit_audited_and_not_readiness_gated(
    api_client: TestClient, database_session: Session
) -> None:
    planned = api_client.post("/trades", json=payload()).json()
    changed = api_client.post(
        f"/trades/{planned['id']}/horizon", json={"trade_horizon": "leap"}
    )
    assert changed.status_code == 200
    assert changed.json()["trade_horizon"] == "leap"

    opened = api_client.post(f"/trades/{planned['id']}/open", json={}).json()
    intraday = api_client.post(
        f"/trades/{opened['id']}/horizon", json={"trade_horizon": "intraday"}
    )
    assert intraday.status_code == 200
    assert intraday.json()["trade_horizon"] == "intraday"
    events = list(
        database_session.scalars(
            select(models.WorkflowEvent)
            .where(models.WorkflowEvent.trade_id == opened["id"])
            .where(models.WorkflowEvent.event_type == "trade_horizon_changed")
            .order_by(models.WorkflowEvent.id)
        )
    )
    assert [
        (event.event_data["old_horizon"], event.event_data["new_horizon"])
        for event in events
    ] == [("swing", "leap"), ("leap", "intraday")]
    assert all("changed_at" in event.event_data for event in events)


def test_closed_trade_cannot_change_horizon(api_client: TestClient) -> None:
    trade = create_and_open(api_client)
    api_client.post(
        f"/trades/{trade['id']}/close",
        json={"exit_price": 105, "exit_reason": "manual_exit"},
    )
    response = api_client.post(
        f"/trades/{trade['id']}/horizon", json={"trade_horizon": "intraday"}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_TRADE_STATE"


def test_opening_creates_one_initial_entry(api_client: TestClient) -> None:
    trade = create_and_open(api_client)
    assert len(trade["entry_executions"]) == 1
    initial = trade["entry_executions"][0]
    assert initial["entry_kind"] == "initial"
    assert initial["underlying_price"] == 100
    assert initial["quantity"] == 2
    assert initial["stop_at_entry"] == 95
    assert initial["reason"] == "initial_plan"
    assert trade["position_summary"]["remaining_quantity"] == 2


def test_add_execution_updates_decimal_position_summary(
    api_client: TestClient,
) -> None:
    trade = create_and_open(api_client)
    response = api_client.post(
        f"/trades/{trade['id']}/entries", json=add_payload()
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["current_stop"] == 100
    assert [item["entry_kind"] for item in body["entry_executions"]] == [
        "initial",
        "add",
    ]
    assert body["position_size"] == 2
    assert body["position_summary"] == {
        "initial_quantity": 2,
        "added_quantity": 1,
        "total_entry_quantity": 3,
        "total_exit_quantity": 0,
        "remaining_quantity": 3,
        "weighted_average_entry": 103.3333,
        "total_underlying_risk": 20,
        "add_count": 1,
        "uses_legacy_fallback": False,
        "accounting_consistent": True,
    }


def test_add_requires_open_trade_positive_values_and_valid_risk(
    api_client: TestClient,
) -> None:
    planned = api_client.post("/trades", json=payload()).json()
    assert (
        api_client.post(
            f"/trades/{planned['id']}/entries", json=add_payload()
        ).status_code
        == 409
    )
    trade = create_and_open(api_client, symbol="MSFT")
    invalid = api_client.post(
        f"/trades/{trade['id']}/entries",
        json=add_payload(stop_at_entry=111),
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "INVALID_ADD_RISK"
    assert (
        api_client.post(
            f"/trades/{trade['id']}/entries",
            json=add_payload(quantity=0),
        ).status_code
        == 422
    )


def test_missing_stop_and_unconfirmed_reversal_block_add(
    api_client: TestClient,
) -> None:
    missing_stop = create_and_open(api_client)
    api_client.patch(
        f"/trades/{missing_stop['id']}", json={"current_stop": None}
    )
    blocked = api_client.post(
        f"/trades/{missing_stop['id']}/entries", json=add_payload()
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "CURRENT_STOP_REQUIRED"

    reversal = create_and_open(
        api_client,
        symbol="TSLA",
        trade_thesis="major_reversal",
        reversal_confirmation="unconfirmed",
    )
    blocked = api_client.post(
        f"/trades/{reversal['id']}/entries", json=add_payload()
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "UNCONFIRMED_REVERSAL_ADD_BLOCKED"


def test_adding_while_negative_requires_action_acknowledgement(
    api_client: TestClient,
) -> None:
    trade = create_and_open(api_client)
    api_client.patch(f"/trades/{trade['id']}", json={"current_price": 99})
    warning = api_client.post(
        f"/trades/{trade['id']}/entries",
        json=add_payload(underlying_price=99, stop_at_entry=94),
    )
    assert warning.status_code == 409
    assert warning.json()["error"]["code"] == "WARNING_ACKNOWLEDGEMENT_REQUIRED"

    accepted = api_client.post(
        f"/trades/{trade['id']}/entries",
        json=add_payload(
            underlying_price=99,
            stop_at_entry=94,
            warnings_acknowledged=["adding_while_losing"],
        ),
    )
    assert accepted.status_code == 201


def test_aggregate_r_and_exit_accounting_include_additions(
    api_client: TestClient,
) -> None:
    trade = create_and_open(api_client)
    api_client.post(
        f"/trades/{trade['id']}/entries", json=add_payload()
    )
    marked = api_client.patch(
        f"/trades/{trade['id']}", json={"current_price": 112}
    ).json()
    assert marked["mfe_r"] == 1.3

    partial = api_client.post(
        f"/trades/{trade['id']}/partial-exits",
        json={"price": 115, "quantity": 1, "exit_reason": "partial_profit"},
    )
    assert partial.status_code == 201
    assert partial.json()["position_summary"]["remaining_quantity"] == 2
    too_large = api_client.post(
        f"/trades/{trade['id']}/partial-exits",
        json={"price": 108, "quantity": 2.01, "exit_reason": "manual_exit"},
    )
    assert too_large.status_code == 422

    closed = api_client.post(
        f"/trades/{trade['id']}/partial-exits",
        json={"price": 108, "quantity": 2, "exit_reason": "manual_exit"},
    )
    assert closed.status_code == 201
    assert closed.json()["status"] == "closed"
    assert closed.json()["position_summary"]["remaining_quantity"] == 0
    assert closed.json()["final_r"] == 1.05


def test_option_add_price_is_reference_only_for_underlying_r(
    api_client: TestClient,
) -> None:
    trade = create_and_open(
        api_client,
        symbol="QQQ",
        market="options",
        direction="long",
        option_type="call",
        option_expiration="2027-01-15",
        option_strike=100,
        option_entry_price=5,
    )
    first = api_client.post(
        f"/trades/{trade['id']}/entries",
        json=add_payload(option_price=2),
    )
    assert first.status_code == 201
    marked = api_client.patch(
        f"/trades/{trade['id']}", json={"current_price": 112}
    ).json()
    assert marked["mfe_r"] == 1.3
    assert first.json()["entry_executions"][-1]["option_price"] == 2


def test_short_aggregate_r_uses_all_entry_legs(api_client: TestClient) -> None:
    trade = create_and_open(
        api_client,
        symbol="NVDA",
        direction="short",
        stop_loss=105,
        target_1=85,
    )
    added = api_client.post(
        f"/trades/{trade['id']}/entries",
        json=add_payload(underlying_price=90, stop_at_entry=100),
    )
    assert added.status_code == 201
    marked = api_client.patch(
        f"/trades/{trade['id']}", json={"current_price": 88}
    )
    assert marked.status_code == 200
    assert marked.json()["mfe_r"] == 1.3


def test_scaling_analytics_use_execution_and_workflow_facts(
    api_client: TestClient,
) -> None:
    trade = create_and_open(api_client)
    api_client.post(f"/trades/{trade['id']}/entries", json=add_payload())
    body = api_client.get("/analytics/discipline").json()["execution_discipline"]
    assert body["trades_with_additions"] == 1
    assert body["position_addition_rate"] == 1
    assert body["total_add_executions"] == 1
    assert body["average_adds_per_trade_with_additions"] == 1


def test_position_added_event_excludes_notes(
    api_client: TestClient, database_session: Session
) -> None:
    trade = create_and_open(api_client)
    api_client.post(
        f"/trades/{trade['id']}/entries",
        json=add_payload(notes="private execution context"),
    )
    event = database_session.scalar(
        select(models.WorkflowEvent)
        .where(models.WorkflowEvent.trade_id == trade["id"])
        .where(models.WorkflowEvent.event_type == "position_added")
    )
    assert event is not None
    assert event.event_data["old_current_stop"] == 95
    assert event.event_data["new_current_stop"] == 100
    assert "notes" not in event.event_data
    assert "private execution context" not in str(event.event_data)


def test_stage29_migration_backfills_representative_trades_idempotently(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'stage29-upgrade.db'}"
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "0015_stage28_warning_integrity")
    engine = create_engine(database_url)
    now = datetime(2026, 7, 24, tzinfo=timezone.utc).isoformat()
    base = {
        "created_at": now,
        "updated_at": now,
        "market": "stocks",
        "direction": "long",
        "setup": "breakout",
        "market_context": "strong_trend",
        "planned_entry": 100,
        "actual_entry": 101,
        "stop_loss": 95,
        "target_1": 110,
        "runner_enabled": 0,
        "runner_active": 0,
        "partial_taken": 0,
        "partial_exit_quantity": 0,
        "trade_horizon": "swing",
        "location_tags": "[]",
        "is_unconfirmed_reversal": 0,
    }
    with engine.begin() as connection:
        for trade_id, symbol, status, size, market in (
            (1, "PLAN", "planned", 2, "stocks"),
            (2, "OPEN", "open", 2, "stocks"),
            (3, "CLOSED", "closed", 2, "stocks"),
            (4, "OPTION", "open", 1, "options"),
            (5, "NULLSIZE", "open", None, "stocks"),
        ):
            values = base | {
                "id": trade_id,
                "symbol": symbol,
                "status": status,
                "position_size": size,
                "market": market,
                "opened_at": now if status != "planned" else None,
                "closed_at": now if status == "closed" else None,
                "option_type": "call" if market == "options" else None,
                "option_entry_price": 4.5 if market == "options" else None,
            }
            connection.execute(
                text(
                    """
                    INSERT INTO trades (
                        id, created_at, updated_at, symbol, market, direction,
                        setup, market_context, planned_entry, actual_entry,
                        stop_loss, target_1, runner_enabled, runner_active,
                        partial_taken, partial_exit_quantity, trade_horizon,
                        location_tags, is_unconfirmed_reversal, status,
                        position_size, opened_at, closed_at, option_type,
                        option_entry_price
                    ) VALUES (
                        :id, :created_at, :updated_at, :symbol, :market,
                        :direction, :setup, :market_context, :planned_entry,
                        :actual_entry, :stop_loss, :target_1, :runner_enabled,
                        :runner_active, :partial_taken, :partial_exit_quantity,
                        :trade_horizon, :location_tags,
                        :is_unconfirmed_reversal, :status, :position_size,
                        :opened_at, :closed_at, :option_type,
                        :option_entry_price
                    )
                    """
                ),
                values,
            )

    command.upgrade(config, "head")
    command.upgrade(config, "head")
    with engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT trade_id, entry_kind, quantity, option_price, reason "
                "FROM trade_entry_executions ORDER BY trade_id"
            )
        ).all()
    assert rows == [
        (2, "initial", 2, None, "legacy_backfill"),
        (3, "initial", 2, None, "legacy_backfill"),
        (4, "initial", 1, 4.5, "legacy_backfill"),
    ]
