"""Pydantic input and output schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


Market = Literal["futures", "stocks", "crypto", "forex", "options", "other"]
Direction = Literal["long", "short"]
TradeStatus = Literal["planned", "open", "closed", "cancelled"]


class TradeCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    market: Market
    direction: Direction
    setup: str = Field(min_length=1, max_length=64)
    market_context: str = Field(min_length=1, max_length=64)
    planned_entry: float
    actual_entry: Optional[float] = None
    stop_loss: float
    target_1: float
    target_2: Optional[float] = None
    runner_enabled: bool = False
    runner_active: bool = False
    position_size: Optional[float] = Field(default=None, gt=0)
    risk_per_trade: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None


class TradeRead(TradeCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    status: TradeStatus
    exit_price: Optional[float]
    exit_reason: Optional[str]
    final_r: Optional[float]
    followed_plan: Optional[bool]
    discipline_score: Optional[int]


class AlertCreate(BaseModel):
    trade_id: int
    rule_id: str
    severity: Literal["blocker", "warning", "reminder"]
    message: str


class AlertRead(AlertCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    acknowledged: bool


class ReviewCreate(BaseModel):
    trade_id: int
    followed_plan: bool
    discipline_score: Optional[int] = Field(default=None, ge=0, le=100)
    mistake_tags: list[str] = Field(default_factory=list)
    lesson: Optional[str] = None


class ReviewRead(ReviewCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class ChecklistAnswerCreate(BaseModel):
    trade_id: int
    question_key: str
    answer: bool
    notes: Optional[str] = None


class ChecklistAnswerRead(ChecklistAnswerCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
