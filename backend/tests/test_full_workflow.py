"""One readable integration test for the complete MVP trade lifecycle."""

from fastapi.testclient import TestClient


def test_complete_trade_discipline_workflow(api_client: TestClient) -> None:
    blocked = api_client.post(
        "/rules/evaluate",
        json={"status": "planned", "stop_loss": None},
    )
    assert blocked.json()["status"] == "blocked"

    warning = api_client.post(
        "/rules/evaluate",
        json={
            "status": "planned",
            "setup": "breakout",
            "stop_loss": 4990,
            "follow_through_confirmed": False,
        },
    )
    assert warning.json()["status"] == "warning"
    assert warning.json()["alerts"][0]["rule_id"] == "breakout_needs_follow_through"

    created = api_client.post(
        "/trades",
        json={
            "symbol": "ES",
            "market": "futures",
            "direction": "long",
            "setup": "breakout",
            "market_context": "strong_trend",
            "planned_entry": 5000,
            "stop_loss": 4990,
            "target_1": 5010,
            "target_2": 5020,
            "runner_enabled": True,
            "position_size": 1,
        },
    ).json()
    assert created["status"] == "planned"

    opened = api_client.post(f"/trades/{created['id']}/open", json={}).json()
    assert opened["status"] == "open"
    assert opened["actual_entry"] == 5000

    one_r = api_client.post(
        "/rules/evaluate",
        json={
            "trade_id": created["id"],
            "current_r": 1,
            "partial_taken": False,
        },
    ).json()
    assert "take_profit_and_let_runner_run" in {
        alert["rule_id"] for alert in one_r["alerts"]
    }

    managed = api_client.patch(
        f"/trades/{created['id']}",
        json={
            "current_price": 5010,
            "partial_exit_quantity": 0.5,
            "runner_active": True,
            "runner_stop": 5000,
        },
    ).json()
    assert managed["partial_taken"] is True
    assert managed["runner_active"] is True
    assert managed["runner_stop"] == 5000

    closed = api_client.post(
        f"/trades/{created['id']}/close",
        json={"exit_price": 5020, "exit_reason": "target_hit"},
    ).json()
    assert closed["status"] == "closed"
    assert closed["final_r"] == 2

    review = api_client.post(
        f"/trades/{created['id']}/review",
        json={
            "exit_price": 5020,
            "exit_reason": "target_hit",
            "followed_plan": "yes",
            "mistake_tags": [],
            "positive_actions": [
                "completed_pre_trade_checklist",
                "followed_planned_stop",
                "took_partial_or_protected_runner",
            ],
            "lesson": "Wait for confirmation and protect the runner.",
        },
    ).json()
    assert review["discipline_score"] == 100
    assert review["trade_classification"] == "good_trade_winner"

    stored = api_client.get(f"/trades/{created['id']}").json()
    summary = api_client.get("/summary/daily").json()
    assert stored["has_review"] is True
    assert summary["total_trades"] == 1
    assert summary["net_r"] == 2
    assert summary["average_discipline_score"] == 100
