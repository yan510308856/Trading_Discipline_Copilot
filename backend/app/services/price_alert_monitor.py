"""Single-process local polling monitor."""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import datetime

from app.database import SessionLocal
from app import models
from app.services.email_sender import env_bool
from app.services.market_data import refresh_open_trade_prices
from app.services.price_alert_service import retry_unsent_events

logger = logging.getLogger(__name__)


@dataclass
class MonitorRuntimeState:
    running: bool = False
    last_monitor_cycle_at: datetime | None = None
    last_price_refresh_at: datetime | None = None
    last_monitor_error: str | None = None


runtime_state = MonitorRuntimeState()


def record_price_refresh(at: datetime) -> None:
    runtime_state.last_price_refresh_at = at


async def run_monitor(stop_event: asyncio.Event) -> None:
    poll_seconds = max(5, int(os.getenv("PRICE_ALERT_POLL_SECONDS", "60")))
    logger.info("price_alert_monitor_started poll_seconds=%s", poll_seconds)
    runtime_state.running = True
    runtime_state.last_monitor_error = None
    try:
        while not stop_event.is_set():
            try:
                with SessionLocal() as database:
                    trades, errors = await asyncio.to_thread(refresh_open_trade_prices, database)
                    retry_unsent_events(database)
                    runtime_state.last_monitor_cycle_at = models.utc_now()
                    runtime_state.last_monitor_error = errors[-1]["message"] if errors else None
                    logger.info("quote_refresh_completed trades=%s errors=%s", len(trades), len(errors))
            except Exception as error:  # keep the local monitor alive and expose the failure
                runtime_state.last_monitor_cycle_at = models.utc_now()
                runtime_state.last_monitor_error = str(error)[:1000]
                logger.exception("price_alert_monitor_cycle_failed")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=poll_seconds)
            except TimeoutError:
                pass
    finally:
        runtime_state.running = False
        logger.info("price_alert_monitor_stopped")


def monitor_enabled() -> bool:
    return env_bool("PRICE_ALERT_MONITOR_ENABLED") and not bool(os.getenv("PYTEST_CURRENT_TEST"))
