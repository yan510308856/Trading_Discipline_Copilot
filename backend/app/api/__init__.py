"""Combined API router for the Trading Discipline Copilot backend."""

from fastapi import APIRouter

from app.api import daily_readiness, market_data, reviews, rules, summary, trades


router = APIRouter()
router.include_router(daily_readiness.router)
router.include_router(trades.router)
router.include_router(rules.router)
router.include_router(market_data.router)
router.include_router(reviews.router)
router.include_router(summary.router)
