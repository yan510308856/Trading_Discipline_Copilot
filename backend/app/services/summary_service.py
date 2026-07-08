"""Daily trading discipline aggregation."""

from __future__ import annotations

from collections import Counter
from datetime import date, datetime, time, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import models


GREEN_TO_RED_TAGS = {"green_trade_to_red_without_review", "green_to_red"}


def daily_summary(database: Session, summary_date: date | None = None) -> dict:
    """Aggregate trades, violations, mistakes, and lessons for one UTC date."""

    selected_date = summary_date or datetime.now(timezone.utc).date()
    start = datetime.combine(selected_date, time.min, tzinfo=timezone.utc)
    end = datetime.combine(selected_date, time.max, tzinfo=timezone.utc)
    activity_time = func.coalesce(
        models.Trade.closed_at,
        models.Trade.opened_at,
        models.Trade.created_at,
    )
    statement = (
        select(models.Trade)
        .options(
            selectinload(models.Trade.alerts),
            selectinload(models.Trade.review),
        )
        .where(activity_time.between(start, end))
        .order_by(activity_time.desc())
    )
    trades = list(database.scalars(statement))

    scores = [
        trade.discipline_score
        for trade in trades
        if trade.discipline_score is not None
    ]
    mistake_counts: Counter[str] = Counter()
    warning_count = 0
    lessons: list[str] = []

    for trade in trades:
        warning_count += sum(
            alert.severity in {"warning", "blocker"} for alert in trade.alerts
        )
        if trade.review is None:
            continue
        mistake_counts.update(trade.review.mistake_tags)
        warning_count += len(trade.review.mistake_tags)
        if trade.review.lesson and trade.review.lesson.strip():
            lessons.append(trade.review.lesson.strip())

    return {
        "date": selected_date.isoformat(),
        "total_trades": len(trades),
        "net_r": round(sum(trade.final_r or 0.0 for trade in trades), 4),
        "average_discipline_score": (
            round(sum(scores) / len(scores), 2) if scores else None
        ),
        "warning_violation_count": warning_count,
        "green_to_red_count": sum(
            mistake_counts[tag] for tag in GREEN_TO_RED_TAGS
        ),
        "revenge_trade_count": sum(
            count for tag, count in mistake_counts.items() if "revenge" in tag
        ),
        "most_frequent_mistakes": [
            {"tag": tag, "count": count}
            for tag, count in mistake_counts.most_common(3)
        ],
        "lessons": lessons,
    }
