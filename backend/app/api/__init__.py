"""Combined API router for the Trading Discipline Copilot backend."""

from fastapi import APIRouter

from app.api import analytics, attention, daily_readiness, market_data, notifications, reviews, rules, summary, trades, warning_dismissals, workflow_events


router = APIRouter()
router.include_router(daily_readiness.router)
router.include_router(trades.router)
router.include_router(rules.router)
router.include_router(market_data.router)
router.include_router(reviews.router)
router.include_router(summary.router)
router.include_router(notifications.router)
router.include_router(attention.router)
router.include_router(workflow_events.router)
router.include_router(analytics.router)
router.include_router(warning_dismissals.router)
