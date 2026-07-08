"""Pydantic input and output schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


Market = Literal["futures", "stocks", "crypto", "forex", "options", "other"]
Direction = Literal["long", "short"]
TradeStatus = Literal["planned", "open", "closed", "cancelled"]
FollowedPlan = Literal["yes", "partial", "no"]
TradeClassification = Literal[
    "good_trade_winner",
    "good_trade_loser",
    "bad_trade_winner",
    "bad_trade_loser",
]


class ReviewSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trade_id: int
    created_at: datetime
    followed_plan: FollowedPlan
    discipline_score: int = Field(ge=0, le=100)
    mistake_tags: list[str]
    positive_actions: list[str]
    lesson: Optional[str]
    notes: Optional[str]
    score_band: str
    triggered_rules: list[str]
    veto_reason: Optional[str]
    trade_classification: TradeClassification


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
    opened_at: Optional[datetime]
    closed_at: Optional[datetime]
    status: TradeStatus
    current_stop: Optional[float]
    current_price: Optional[float]
    runner_stop: Optional[float]
    partial_taken: bool
    partial_exit_quantity: float
    exit_price: Optional[float]
    exit_reason: Optional[str]
    final_r: Optional[float]
    followed_plan: Optional[FollowedPlan]
    discipline_score: Optional[int]
    has_review: bool
    review: Optional[ReviewSummary]


class TradePatch(BaseModel):
    symbol: Optional[str] = Field(default=None, min_length=1, max_length=32)
    market: Optional[Market] = None
    direction: Optional[Direction] = None
    setup: Optional[str] = Field(default=None, min_length=1, max_length=64)
    market_context: Optional[str] = Field(default=None, min_length=1, max_length=64)
    planned_entry: Optional[float] = None
    actual_entry: Optional[float] = None
    stop_loss: Optional[float] = None
    current_stop: Optional[float] = None
    current_price: Optional[float] = None
    target_1: Optional[float] = None
    target_2: Optional[float] = None
    runner_enabled: Optional[bool] = None
    runner_active: Optional[bool] = None
    runner_stop: Optional[float] = None
    partial_taken: Optional[bool] = None
    partial_exit_quantity: Optional[float] = Field(default=None, ge=0)
    position_size: Optional[float] = Field(default=None, gt=0)
    risk_per_trade: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def reject_null_for_required_database_fields(self) -> "TradePatch":
        required_fields = {
            "symbol",
            "market",
            "direction",
            "setup",
            "market_context",
            "planned_entry",
            "stop_loss",
            "target_1",
            "runner_enabled",
            "runner_active",
        }
        null_fields = {
            field
            for field in required_fields & self.model_fields_set
            if getattr(self, field) is None
        }
        if null_fields:
            raise ValueError(
                f"Fields cannot be null: {', '.join(sorted(null_fields))}"
            )
        return self


class TradeOpen(BaseModel):
    actual_entry: Optional[float] = None


class TradeClose(BaseModel):
    exit_price: float
    exit_reason: str = Field(min_length=1, max_length=128)


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


class ReviewRead(ReviewSummary):
    pass


class ReviewRequest(BaseModel):
    exit_price: float
    exit_reason: str = Field(min_length=1, max_length=128)
    followed_plan: FollowedPlan
    mistake_tags: list[str] = Field(default_factory=list)
    positive_actions: list[str] = Field(default_factory=list)
    lesson: Optional[str] = None
    notes: Optional[str] = None


class RuleEvaluationRequest(BaseModel):
    """Known routing fields plus any rule-specific trade facts."""

    model_config = ConfigDict(extra="allow")

    trade_id: Optional[int] = Field(default=None, gt=0)
    status: Optional[TradeStatus] = None


class RuleAlert(BaseModel):
    rule_id: str
    severity: Literal["blocker", "warning", "reminder"]
    message: str
    checklist: list[str]
    discipline_sentence: str


class RuleDefinition(BaseModel):
    id: str
    name: str
    category: str
    stage: Literal["pre_trade", "in_trade", "post_trade"]
    severity: Literal["blocker", "warning", "reminder"]
    trigger: dict[str, Any]
    conditions: list[dict[str, Any]]
    message: str
    checklist: list[str]
    avoid: str
    discipline_sentence: str
    enabled: bool


class RuleEvaluationResult(BaseModel):
    status: Literal["allowed", "warning", "blocked"]
    alerts: list[RuleAlert]


class MistakeFrequency(BaseModel):
    tag: str
    count: int


class DailySummary(BaseModel):
    date: str
    total_trades: int
    net_r: float
    average_discipline_score: Optional[float]
    warning_violation_count: int
    green_to_red_count: int
    revenge_trade_count: int
    most_frequent_mistakes: list[MistakeFrequency]
    lessons: list[str]


class ChecklistAnswerCreate(BaseModel):
    trade_id: int
    question_key: str
    answer: bool
    notes: Optional[str] = None


class ChecklistAnswerRead(ChecklistAnswerCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
