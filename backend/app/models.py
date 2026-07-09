"""SQLAlchemy persistence models for the trade discipline workflow."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    opened_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    symbol: Mapped[str] = mapped_column(String(32), index=True)
    market: Mapped[str] = mapped_column(String(32))
    direction: Mapped[str] = mapped_column(String(8))
    setup: Mapped[str] = mapped_column(String(64))
    market_context: Mapped[str] = mapped_column(String(64))
    planned_entry: Mapped[float] = mapped_column(Float)
    actual_entry: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    stop_loss: Mapped[float] = mapped_column(Float)
    current_stop: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    target_1: Mapped[float] = mapped_column(Float)
    target_2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    runner_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    runner_active: Mapped[bool] = mapped_column(Boolean, default=False)
    runner_stop: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    partial_taken: Mapped[bool] = mapped_column(Boolean, default=False)
    partial_exit_quantity: Mapped[float] = mapped_column(Float, default=0.0)
    position_size: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    risk_per_trade: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="planned", index=True)
    exit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    exit_reason: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    final_r: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    mfe_r: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    mae_r: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    followed_plan: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    discipline_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    alerts: Mapped[list["Alert"]] = relationship(
        back_populates="trade", cascade="all, delete-orphan"
    )
    checklist_answers: Mapped[list["ChecklistAnswer"]] = relationship(
        back_populates="trade", cascade="all, delete-orphan"
    )
    review: Mapped[Optional["Review"]] = relationship(
        back_populates="trade", cascade="all, delete-orphan", uselist=False
    )
    executions: Mapped[list["TradeExecution"]] = relationship(
        back_populates="trade",
        cascade="all, delete-orphan",
        order_by="TradeExecution.executed_at",
    )

    @property
    def has_review(self) -> bool:
        return self.review is not None


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trades.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    rule_id: Mapped[str] = mapped_column(String(128), index=True)
    severity: Mapped[str] = mapped_column(String(16))
    message: Mapped[str] = mapped_column(Text)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)

    trade: Mapped[Trade] = relationship(back_populates="alerts")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(
        ForeignKey("trades.id", ondelete="CASCADE"), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    followed_plan: Mapped[str] = mapped_column(String(16))
    discipline_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mistake_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    positive_actions: Mapped[list[str]] = mapped_column(JSON, default=list)
    lesson: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score_band: Mapped[str] = mapped_column(String(64))
    triggered_rules: Mapped[list[str]] = mapped_column(JSON, default=list)
    veto_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trade_classification: Mapped[str] = mapped_column(String(32))

    trade: Mapped[Trade] = relationship(back_populates="review")


class ChecklistAnswer(Base):
    __tablename__ = "checklist_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trades.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    question_key: Mapped[str] = mapped_column(String(128))
    answer: Mapped[bool] = mapped_column(Boolean)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    trade: Mapped[Trade] = relationship(back_populates="checklist_answers")


class TradeExecution(Base):
    __tablename__ = "trade_executions"

    id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(
        ForeignKey("trades.id", ondelete="CASCADE"), index=True
    )
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    execution_type: Mapped[str] = mapped_column(String(16))
    price: Mapped[float] = mapped_column(Float)
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    trade: Mapped[Trade] = relationship(back_populates="executions")


class DailyReadiness(Base):
    __tablename__ = "daily_readiness"

    id: Mapped[int] = mapped_column(primary_key=True)
    readiness_date: Mapped[date] = mapped_column(Date, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    checklist_items: Mapped[list[dict]] = mapped_column(JSON, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_cleared_for_intraday: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_required_count: Mapped[int] = mapped_column(Integer, default=0)
    total_required_count: Mapped[int] = mapped_column(Integer, default=0)
