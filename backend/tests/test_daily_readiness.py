from datetime import date

from fastapi.testclient import TestClient


def test_default_daily_readiness_contains_required_and_optional_items(
    api_client: TestClient,
) -> None:
    response = api_client.get("/daily-readiness?date=2026-07-09")

    assert response.status_code == 200
    body = response.json()
    assert body["readiness_date"] == "2026-07-09"
    assert body["required_complete_count"] == 0
    assert body["required_total_count"] == 5
    assert body["is_cleared_for_intraday"] is False
    assert body["status"] == "not_cleared"
    assert len(body["items"]) == 8
    assert {item["id"] for item in body["items"]} >= {
        "watchlist_selected",
        "daily_risk_limits_set",
        "mental_state_checked",
    }
    assert sum(1 for item in body["items"] if item["required"]) == 5
    assert sum(1 for item in body["items"] if not item["required"]) == 3


def test_required_completion_count_and_partial_status(api_client: TestClient) -> None:
    response = api_client.put(
        "/daily-readiness/2026-07-09",
        json={
            "items": [
                {"id": "watchlist_selected", "completed": True, "notes": "ES, NQ"},
                {
                    "id": "market_environment_assessed",
                    "completed": True,
                    "notes": "Gap day, uncertain after open.",
                },
                {
                    "id": "platform_ready",
                    "completed": True,
                    "notes": "Data feed connected.",
                },
            ],
            "notes": "Preparing carefully.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["required_complete_count"] == 2
    assert body["required_total_count"] == 5
    assert body["is_cleared_for_intraday"] is False
    assert body["status"] == "partially_ready"
    assert body["notes"] == "Preparing carefully."


def test_readiness_is_cleared_when_all_required_items_complete(
    api_client: TestClient,
) -> None:
    required_items = [
        "watchlist_selected",
        "market_environment_assessed",
        "important_events_checked",
        "swing_positions_reviewed",
        "daily_risk_limits_set",
    ]

    response = api_client.put(
        "/daily-readiness/2026-07-09",
        json={
            "items": [
                {"id": item_id, "completed": True, "notes": "Done"}
                for item_id in required_items
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["required_complete_count"] == 5
    assert body["required_total_count"] == 5
    assert body["is_cleared_for_intraday"] is True
    assert body["status"] == "cleared"


def test_updating_notes_and_completion_persists(api_client: TestClient) -> None:
    api_client.put(
        "/daily-readiness/2026-07-09",
        json={
            "items": [
                {
                    "id": "important_events_checked",
                    "completed": True,
                    "notes": "CPI at 8:30, Fed speaker at 13:00.",
                }
            ],
        },
    )

    response = api_client.get("/daily-readiness?date=2026-07-09")

    assert response.status_code == 200
    important_events = next(
        item
        for item in response.json()["items"]
        if item["id"] == "important_events_checked"
    )
    assert important_events["completed"] is True
    assert important_events["notes"] == "CPI at 8:30, Fed speaker at 13:00."


def test_today_endpoint_returns_todays_readiness(api_client: TestClient) -> None:
    response = api_client.get("/daily-readiness/today")

    assert response.status_code == 200
    assert response.json()["readiness_date"] == date.today().isoformat()


def test_unknown_item_id_returns_error_envelope(api_client: TestClient) -> None:
    response = api_client.put(
        "/daily-readiness/2026-07-09",
        json={"items": [{"id": "not_real", "completed": True, "notes": ""}]},
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "UNKNOWN_READINESS_ITEM",
            "message": "Daily readiness contains unknown checklist item IDs.",
            "details": {"item_ids": ["not_real"]},
        }
    }
