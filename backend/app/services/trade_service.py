"""Trade persistence and lifecycle operations."""

from datetime import date, datetime, time, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.errors import APIError


def create_planned_trade(database: Session, trade_data: schemas.TradeCreate) -> models.Trade:
    """Persist a new trade plan in the initial planned state."""

    trade = models.Trade(**trade_data.model_dump(), status="planned")
    database.add(trade)
    database.commit()
    database.refresh(trade)
    return trade


def list_trades(database: Session) -> list[models.Trade]:
    return list(database.scalars(select(models.Trade).order_by(models.Trade.id.desc())))


def get_trade(database: Session, trade_id: int) -> models.Trade:
    trade = database.get(models.Trade, trade_id)
    if trade is None:
        raise APIError(
            404,
            "TRADE_NOT_FOUND",
            f"Trade {trade_id} was not found.",
            {"trade_id": trade_id},
        )
    return trade


def update_trade(
    database: Session, trade_id: int, trade_data: schemas.TradePatch
) -> models.Trade:
    trade = get_trade(database, trade_id)
    for field, value in trade_data.model_dump(exclude_unset=True).items():
        setattr(trade, field, value)
    database.commit()
    database.refresh(trade)
    return trade


def _require_status(trade: models.Trade, expected: str, action: str) -> None:
    if trade.status != expected:
        raise APIError(
            409,
            "INVALID_TRADE_STATE",
            f"Only {expected} trades can be {action}.",
            {"trade_id": trade.id, "current_status": trade.status},
        )


def open_trade(
    database: Session, trade_id: int, trade_data: schemas.TradeOpen
) -> models.Trade:
    trade = get_trade(database, trade_id)
    _require_status(trade, "planned", "opened")
    trade.actual_entry = (
        trade.planned_entry
        if trade_data.actual_entry is None
        else trade_data.actual_entry
    )
    trade.status = "open"
    database.commit()
    database.refresh(trade)
    return trade


def close_trade(
    database: Session, trade_id: int, trade_data: schemas.TradeClose
) -> models.Trade:
    trade = get_trade(database, trade_id)
    _require_status(trade, "open", "closed")
    trade.exit_price = trade_data.exit_price
    trade.exit_reason = trade_data.exit_reason
    trade.final_r = trade_data.final_r
    trade.status = "closed"
    trade.runner_active = False
    database.commit()
    database.refresh(trade)
    return trade


def cancel_trade(database: Session, trade_id: int) -> models.Trade:
    trade = get_trade(database, trade_id)
    _require_status(trade, "planned", "cancelled")
    trade.status = "cancelled"
    database.commit()
    database.refresh(trade)
    return trade


def create_review(
    database: Session, trade_id: int, review_data: schemas.ReviewRequest
) -> models.Review:
    trade = get_trade(database, trade_id)
    if trade.review is not None:
        raise APIError(
            409,
            "REVIEW_ALREADY_EXISTS",
            "This trade already has a review.",
            {"trade_id": trade_id},
        )

    review = models.Review(trade_id=trade_id, **review_data.model_dump())
    trade.followed_plan = review_data.followed_plan
    trade.discipline_score = review_data.discipline_score
    database.add(review)
    database.commit()
    database.refresh(review)
    return review


def daily_summary(database: Session, summary_date: date | None = None) -> dict:
    selected_date = summary_date or datetime.now(timezone.utc).date()
    start = datetime.combine(selected_date, time.min, tzinfo=timezone.utc)
    end = datetime.combine(selected_date, time.max, tzinfo=timezone.utc)
    statement = select(
        func.count(models.Trade.id),
        func.coalesce(func.sum(models.Trade.final_r), 0.0),
        func.avg(models.Trade.discipline_score),
    ).where(models.Trade.created_at.between(start, end))
    total, net_r, average_score = database.execute(statement).one()
    return {
        "date": selected_date.isoformat(),
        "total_trades": total,
        "net_r": float(net_r),
        "average_discipline_score": (
            float(average_score) if average_score is not None else None
        ),
    }
