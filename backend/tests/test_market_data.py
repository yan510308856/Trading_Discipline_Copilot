from app.services.market_data import ManualMarketDataProvider


def test_manual_market_data_provider_has_no_automatic_quote() -> None:
    provider = ManualMarketDataProvider()

    assert provider.latest_quote("ES", "futures") is None
