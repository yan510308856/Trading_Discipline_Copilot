from __future__ import annotations

from io import BytesIO
from urllib.error import HTTPError

from fastapi.testclient import TestClient

from app.services import market_data
from app.errors import APIError
from app.services.market_data import FinnhubMarketDataProvider, ManualMarketDataProvider, Quote


def test_manual_market_data_provider_has_no_automatic_quote() -> None:
    provider = ManualMarketDataProvider()

    assert provider.latest_quote("ES", "futures") is None


def test_finnhub_provider_reads_current_stock_price(monkeypatch) -> None:
    captured = {}

    def fake_urlopen(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return BytesIO(b'{"c": 182.5, "t": 1700000000}')

    monkeypatch.setattr(market_data, "urlopen", fake_urlopen)
    provider = FinnhubMarketDataProvider("secret-key", cache_seconds=30)

    quote = provider.latest_quote("aapl", "stocks")

    assert quote == Quote("AAPL", 182.5, "finnhub", 1700000000)
    assert "symbol=AAPL" in captured["request"].full_url
    assert captured["request"].get_header("X-finnhub-token") == "secret-key"
    assert provider.latest_quote("ES", "futures") is None


def test_finnhub_provider_reports_invalid_key(monkeypatch) -> None:
    def unauthorized(request, timeout):
        raise HTTPError(request.full_url, 401, "Unauthorized", {}, BytesIO(b"{}"))

    monkeypatch.setattr(market_data, "urlopen", unauthorized)

    try:
        FinnhubMarketDataProvider("invalid").latest_quote("UPS", "stocks")
    except APIError as error:
        assert error.code == "FINNHUB_AUTH_ERROR"
        assert "Invalid Finnhub API key" in error.message
    else:
        raise AssertionError("Expected invalid Finnhub credentials to fail")


def test_quote_endpoint_returns_mocked_quote(api_client: TestClient, monkeypatch) -> None:
    class FakeProvider:
        def latest_quote(self, symbol: str, market: str) -> Quote | None:
            assert market == "stocks"
            return Quote(symbol, 182.456, "fake", 1700000000)

    monkeypatch.setattr(
        market_data, "configured_market_data_provider", lambda: FakeProvider()
    )

    response = api_client.get("/market-data/quote?symbol=aapl")

    assert response.status_code == 200
    body = response.json()
    assert body["symbol"] == "AAPL"
    assert body["price"] == 182.46
    assert body["source"] == "fake"
    assert body["fetched_at"].startswith("2023-11-14T")
    assert body["message"] is None


def test_quote_endpoint_handles_unavailable_provider(api_client: TestClient) -> None:
    response = api_client.get("/market-data/quote?symbol=SPY")

    assert response.status_code == 200
    body = response.json()
    assert body["symbol"] == "SPY"
    assert body["price"] is None
    assert body["source"] == "manual"
    assert body["message"] == "Price could not be fetched. Enter price manually."


def test_refresh_open_stock_and_build_attention(
    api_client: TestClient, monkeypatch
) -> None:
    class FakeProvider:
        def latest_quote(self, symbol: str, market: str) -> Quote | None:
            return Quote(symbol, 110.0, "fake") if market == "stocks" else None

    monkeypatch.setattr(
        market_data, "configured_market_data_provider", lambda: FakeProvider()
    )
    created = api_client.post(
        "/trades",
        json={
            "symbol": "AAPL",
            "market": "stocks",
            "direction": "long",
            "setup": "pullback",
            "market_context": "strong_trend",
            "planned_entry": 100,
            "stop_loss": 90,
            "target_1": 120,
            "position_size": 2,
        },
    ).json()
    api_client.post(f"/trades/{created['id']}/open", json={})

    refresh = api_client.post("/market-data/refresh-open")
    attention = api_client.get("/rules/open-attention")

    assert refresh.status_code == 200
    assert refresh.json()["trades"][0]["current_price"] == 110
    assert refresh.json()["errors"] == []
    assert refresh.json()["source"] == "manual"
    assert attention.status_code == 200
    assert attention.json()[0]["current_r"] == 1
