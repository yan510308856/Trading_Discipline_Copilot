"""Single-process local polling monitor."""

from __future__ import annotations

import asyncio
import logging
import os

from app.database import SessionLocal
from app.services.email_sender import env_bool
from app.services.market_data import refresh_open_trade_prices
from app.services.price_alert_service import retry_unsent_events

logger = logging.getLogger(__name__)


async def run_monitor(stop_event: asyncio.Event) -> None:
    poll_seconds = max(5, int(os.getenv("PRICE_ALERT_POLL_SECONDS", "60")))
    logger.info("price_alert_monitor_started poll_seconds=%s", poll_seconds)
    try:
        while not stop_event.is_set():
            with SessionLocal() as database:
                trades, errors = await asyncio.to_thread(refresh_open_trade_prices, database)
                retry_unsent_events(database)
                logger.info("quote_refresh_completed trades=%s errors=%s", len(trades), len(errors))
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=poll_seconds)
            except TimeoutError:
                pass
    finally:
        logger.info("price_alert_monitor_stopped")


def monitor_enabled() -> bool:
    return env_bool("PRICE_ALERT_MONITOR_ENABLED") and not bool(os.getenv("PYTEST_CURRENT_TEST"))
