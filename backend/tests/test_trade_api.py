from fastapi.testclient import TestClient


def planned_trade_payload() -> dict:
    return {
        "symbol": "ES",
        "market": "futures",
        "direction": "long",
        "setup": "breakout",
        "market_context": "strong_trend",
        "planned_entry": 5000,
        "stop_loss": 4990,
        "target_1": 5020,
        "runner_enabled": True,
    }


def create_trade(client: TestClient) -> dict:
    response = client.post("/trades", json=planned_trade_payload())
    assert response.status_code == 201
    return response.json()


def test_health_check(api_client: TestClient) -> None:
    response = api_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_get_patch_and_list_trade(api_client: TestClient) -> None:
    created = create_trade(api_client)

    assert created["status"] == "planned"
    assert api_client.get(f"/trades/{created['id']}").json()["symbol"] == "ES"

    patch_response = api_client.patch(
        f"/trades/{created['id']}", json={"notes": "Wait for confirmation."}
    )
    list_response = api_client.get("/trades")

    assert patch_response.status_code == 200
    assert patch_response.json()["notes"] == "Wait for confirmation."
    assert [trade["id"] for trade in list_response.json()] == [created["id"]]


def test_evaluate_rules_for_draft_and_existing_trade(api_client: TestClient) -> None:
    draft_response = api_client.post(
        "/rules/evaluate",
        json={"status": "planned", "stop_loss": None},
    )
    created = create_trade(api_client)
    stored_response = api_client.post(
        "/rules/evaluate",
        json={"trade_id": created["id"], "follow_through_confirmed": False},
    )

    assert draft_response.json()["status"] == "blocked"
    assert stored_response.json()["status"] == "warning"
    assert stored_response.json()["alerts"][0]["rule_id"] == (
        "breakout_needs_follow_through"
    )


def test_open_and_close_trade(api_client: TestClient) -> None:
    created = create_trade(api_client)

    opened = api_client.post(
        f"/trades/{created['id']}/open", json={"actual_entry": 5001}
    )
    closed = api_client.post(
        f"/trades/{created['id']}/close",
        json={"exit_price": 5021, "exit_reason": "target_hit", "final_r": 2.0},
    )

    assert opened.status_code == 200
    assert opened.json()["status"] == "open"
    assert opened.json()["actual_entry"] == 5001
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    assert closed.json()["final_r"] == 2.0


def test_open_trade_preserves_explicit_zero_entry(api_client: TestClient) -> None:
    created = create_trade(api_client)

    response = api_client.post(
        f"/trades/{created['id']}/open", json={"actual_entry": 0}
    )

    assert response.status_code == 200
    assert response.json()["actual_entry"] == 0


def test_cancel_trade(api_client: TestClient) -> None:
    created = create_trade(api_client)

    response = api_client.post(f"/trades/{created['id']}/cancel")

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_create_review_and_daily_summary(api_client: TestClient) -> None:
    created = create_trade(api_client)
    review = api_client.post(
        f"/trades/{created['id']}/review",
        json={
            "followed_plan": True,
            "discipline_score": 90,
            "mistake_tags": [],
            "lesson": "Waited for confirmation.",
        },
    )
    summary = api_client.get("/summary/daily")

    assert review.status_code == 201
    assert review.json()["trade_id"] == created["id"]
    assert summary.status_code == 200
    assert summary.json()["total_trades"] == 1
    assert summary.json()["average_discipline_score"] == 90


def test_get_rules(api_client: TestClient) -> None:
    response = api_client.get("/rules")

    assert response.status_code == 200
    assert len(response.json()) == 8


def test_validation_and_business_errors_use_standard_envelope(
    api_client: TestClient,
) -> None:
    validation_response = api_client.post("/trades", json={"symbol": "ES"})
    created_for_patch = create_trade(api_client)
    patch_response = api_client.patch(
        f"/trades/{created_for_patch['id']}", json={"stop_loss": None}
    )
    not_found_response = api_client.get("/trades/999")

    created = create_trade(api_client)
    api_client.post(f"/trades/{created['id']}/cancel")
    state_response = api_client.post(
        f"/trades/{created['id']}/open", json={}
    )

    for response in (
        validation_response,
        patch_response,
        not_found_response,
        state_response,
    ):
        assert set(response.json()["error"]) == {"code", "message", "details"}

    assert validation_response.status_code == 422
    assert validation_response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert patch_response.status_code == 422
    assert patch_response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert not_found_response.status_code == 404
    assert not_found_response.json()["error"]["code"] == "TRADE_NOT_FOUND"
    assert state_response.status_code == 409
    assert state_response.json()["error"]["code"] == "INVALID_TRADE_STATE"
