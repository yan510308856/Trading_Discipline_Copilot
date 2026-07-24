"""Pydantic input and output schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


Market = Literal["futures", "stocks", "crypto", "forex", "options", "other"]
Direction = Literal["long", "short"]
TradeHorizon = Literal["swing", "intraday", "leap", "other"]
MarketState = Literal["strong_trend", "narrow_channel", "broad_channel", "trading_range", "breakout_mode", "unclear"]
TradeThesis = Literal["pullback_continuation", "breakout", "breakout_pullback", "failed_breakout", "range_reversal", "major_reversal", "other"]
EntryTrigger = Literal["h1_h2_l1_l2", "second_entry", "wedge", "double_top_bottom", "inside_bar_triangle", "strong_signal_bar", "breakout_retest", "other"]
LocationTag = Literal["opening_range", "gap_open", "range_high", "range_low", "prior_day_high", "prior_day_low", "support", "resistance", "pullback_zone", "breakout_point"]
LocationDecision = Literal["selected", "none"]
ReversalConfirmation = Literal["confirmed", "unconfirmed"]
TradeStatus = Literal["planned", "open", "closed", "cancelled"]
FollowedPlan = Literal["yes", "partial", "no"]
TradeClassification = Literal[
    "good_trade_winner",
    "good_trade_loser",
    "bad_trade_winner",
    "bad_trade_loser",
]
ReadinessStatus = Literal["not_cleared", "partially_ready", "cleared"]
OptionType = Literal["call", "put"]
ExitReason = Literal[
    "partial_profit", "target_hit", "stop_hit", "runner_stop", "risk_reduction",
    "invalidated_setup", "time_exit", "manual_exit", "other",
]
EntryKind = Literal["initial", "add"]
AddReason = Literal[
    "breakout_confirmation",
    "pullback_continuation",
    "risk_reentry",
    "trend_continuation",
    "other",
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


class TradeExecutionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trade_id: int
    executed_at: datetime
    execution_type: Literal["partial", "final"]
    price: float
    quantity: Optional[float]
    exit_reason: Optional[ExitReason]
    option_price: Optional[float]


class TradeEntryExecutionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trade_id: int
    executed_at: datetime
    entry_kind: EntryKind
    underlying_price: float
    quantity: float
    stop_at_entry: float
    option_price: Optional[float]
    reason: str
    notes: Optional[str]
    created_at: datetime


class PositionSummaryRead(BaseModel):
    initial_quantity: float
    added_quantity: float
    total_entry_quantity: float
    total_exit_quantity: float
    remaining_quantity: float
    weighted_average_entry: Optional[float]
    total_underlying_risk: float
    add_count: int
    uses_legacy_fallback: bool
    accounting_consistent: bool


class TradeCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    option_contract: Optional[str] = Field(default=None, max_length=128)
    option_type: Optional[OptionType] = None
    option_expiration: Optional[date] = None
    option_strike: Optional[float] = Field(default=None, gt=0)
    option_entry_price: Optional[float] = Field(default=None, gt=0)
    trade_horizon: TradeHorizon = "intraday"
    market: Market
    direction: Direction
    setup: str = Field(min_length=1, max_length=64)
    market_context: str = Field(min_length=1, max_length=64)
    market_state: MarketState
    trade_thesis: TradeThesis
    entry_trigger: EntryTrigger
    location_tags: list[LocationTag] = Field(default_factory=list)
    location_decision: LocationDecision
    reversal_confirmation: Optional[ReversalConfirmation] = None
    is_unconfirmed_reversal: bool = False
    planned_entry: float
    actual_entry: Optional[float] = None
    stop_loss: float
    target_1: float
    target_2: Optional[float] = None
    runner_enabled: bool = False
    runner_active: bool = False
    position_size: float = Field(gt=0)
    risk_per_trade: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_classification(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        from app.services.price_action_taxonomy import add_legacy_mirrors, classification_from_legacy
        data = dict(value)
        had_structured_classification = any(
            field in data
            for field in ("market_state", "trade_thesis", "entry_trigger", "location_tags")
        )
        if not all(data.get(field) for field in ("market_state", "trade_thesis", "entry_trigger")):
            legacy = classification_from_legacy(data.get("setup"), data.get("market_context"))
            for field, mapped in legacy.items():
                data.setdefault(field, mapped)
        if data.get("location_tags") and data.get("location_decision") is None:
            data["location_decision"] = "selected"
        elif not had_structured_classification and data.get("location_decision") is None:
            # Compatibility for pre-taxonomy clients. The current UI never uses
            # this path and requires an explicit decision.
            data["location_decision"] = "none"
        add_legacy_mirrors(data)
        return data

    @field_validator("location_tags")
    @classmethod
    def normalize_create_location_tags(cls, value: list[LocationTag]) -> list[LocationTag]:
        from app.services.price_action_taxonomy import ordered_location_tags
        return ordered_location_tags(value)  # type: ignore[arg-type]

    @field_validator(
        "planned_entry",
        "actual_entry",
        "stop_loss",
        "target_1",
        "target_2",
        "option_entry_price",
        "position_size",
        "risk_per_trade",
    )
    @classmethod
    def round_trade_numbers(cls, value: Optional[float]) -> Optional[float]:
        return None if value is None else round(value, 2)

    @field_validator("option_contract")
    @classmethod
    def clean_option_contract(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def clear_option_contract_for_non_options(self) -> "TradeCreate":
        if self.__class__.__name__ != "TradeCreate":
            return self
        if self.location_decision == "selected" and not self.location_tags:
            raise ValueError("Selected key locations require at least one location tag.")
        if self.location_decision == "none" and self.location_tags:
            raise ValueError("No key location requires an empty location tag list.")
        if self.trade_thesis == "major_reversal" and self.reversal_confirmation is None:
            raise ValueError("Major reversals require explicit reversal confirmation.")
        if self.trade_thesis != "major_reversal":
            self.reversal_confirmation = None
        self.is_unconfirmed_reversal = self.reversal_confirmation == "unconfirmed"
        if self.market != "options":
            self.option_contract = None
            self.option_type = None
            self.option_expiration = None
            self.option_strike = None
            self.option_entry_price = None
        elif any((self.option_type, self.option_expiration, self.option_strike)) and not all(
            (self.option_type, self.option_expiration, self.option_strike)
        ):
            raise ValueError("Structured option fields must be supplied together.")
        return self


class TradeRead(TradeCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    market_state: Optional[MarketState] = None
    trade_thesis: Optional[TradeThesis] = None
    entry_trigger: Optional[EntryTrigger] = None
    location_decision: Optional[LocationDecision] = None
    reversal_confirmation: Optional[ReversalConfirmation] = None
    created_at: datetime
    updated_at: datetime
    opened_at: Optional[datetime]
    closed_at: Optional[datetime]
    status: TradeStatus
    current_stop: Optional[float]
    current_price: Optional[float]
    current_price_source: Optional[str]
    current_price_updated_at: Optional[datetime]
    position_size: Optional[float] = None
    option_current_price: Optional[float]
    runner_stop: Optional[float]
    partial_taken: bool
    partial_exit_quantity: float
    exit_price: Optional[float]
    exit_reason: Optional[str]
    final_r: Optional[float]
    mfe_r: Optional[float]
    mae_r: Optional[float]
    followed_plan: Optional[FollowedPlan]
    discipline_score: Optional[int]
    has_review: bool
    review: Optional[ReviewSummary]
    entry_executions: list[TradeEntryExecutionRead]
    executions: list[TradeExecutionRead]
    position_summary: PositionSummaryRead


class TradePatch(BaseModel):
    symbol: Optional[str] = Field(default=None, min_length=1, max_length=32)
    option_contract: Optional[str] = Field(default=None, max_length=128)
    option_type: Optional[OptionType] = None
    option_expiration: Optional[date] = None
    option_strike: Optional[float] = Field(default=None, gt=0)
    option_entry_price: Optional[float] = Field(default=None, gt=0)
    trade_horizon: Optional[TradeHorizon] = None
    market: Optional[Market] = None
    direction: Optional[Direction] = None
    setup: Optional[str] = Field(default=None, min_length=1, max_length=64)
    market_context: Optional[str] = Field(default=None, min_length=1, max_length=64)
    market_state: Optional[MarketState] = None
    trade_thesis: Optional[TradeThesis] = None
    entry_trigger: Optional[EntryTrigger] = None
    location_decision: Optional[LocationDecision] = None
    reversal_confirmation: Optional[ReversalConfirmation] = None
    location_tags: Optional[list[LocationTag]] = None
    is_unconfirmed_reversal: Optional[bool] = None
    planned_entry: Optional[float] = None
    actual_entry: Optional[float] = None
    stop_loss: Optional[float] = None
    current_stop: Optional[float] = None
    current_price: Optional[float] = None
    option_current_price: Optional[float] = Field(default=None, gt=0)
    target_1: Optional[float] = None
    target_2: Optional[float] = None
    runner_enabled: Optional[bool] = None
    runner_active: Optional[bool] = None
    runner_stop: Optional[float] = None
    position_size: Optional[float] = Field(default=None, gt=0)
    risk_per_trade: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None

    @field_validator("location_tags")
    @classmethod
    def normalize_location_tags(cls, value: Optional[list[LocationTag]]) -> Optional[list[LocationTag]]:
        if value is None:
            return None
        from app.services.price_action_taxonomy import ordered_location_tags
        return ordered_location_tags(value)  # type: ignore[arg-type]

    @field_validator(
        "planned_entry",
        "actual_entry",
        "stop_loss",
        "current_stop",
        "current_price",
        "option_entry_price",
        "option_current_price",
        "target_1",
        "target_2",
        "runner_stop",
        "position_size",
        "risk_per_trade",
    )
    @classmethod
    def round_trade_numbers(cls, value: Optional[float]) -> Optional[float]:
        return None if value is None else round(value, 2)

    @field_validator("option_contract")
    @classmethod
    def clean_option_contract(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def reject_null_for_required_database_fields(self) -> "TradePatch":
        required_fields = {
            "symbol",
            "trade_horizon",
            "market",
            "direction",
            "setup",
            "market_context",
            "market_state",
            "trade_thesis",
            "entry_trigger",
            "location_decision",
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
    option_entry_price: Optional[float] = Field(default=None, gt=0)


class TradeHorizonChange(BaseModel):
    trade_horizon: TradeHorizon


class TradeEntryExecutionCreate(BaseModel):
    underlying_price: float = Field(gt=0, le=1_000_000_000)
    quantity: float = Field(gt=0, le=1_000_000_000)
    stop_at_entry: float = Field(gt=0, le=1_000_000_000)
    reason: AddReason
    option_price: Optional[float] = Field(
        default=None, gt=0, le=1_000_000_000
    )
    notes: Optional[str] = Field(default=None, max_length=2_000)
    warnings_acknowledged: list[str] = Field(default_factory=list)

    @field_validator(
        "underlying_price", "quantity", "stop_at_entry", "option_price"
    )
    @classmethod
    def round_entry_numbers(cls, value: Optional[float]) -> Optional[float]:
        return None if value is None else round(value, 2)


class TradeClose(BaseModel):
    exit_price: float
    exit_reason: ExitReason


class PartialExitCreate(BaseModel):
    price: float
    quantity: float = Field(gt=0)
    exit_reason: ExitReason = "partial_profit"
    option_price: Optional[float] = Field(default=None, gt=0)


class TradePriceAlertEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trade_id: int
    alert_kind: Literal["target_1", "target_2", "stop"]
    threshold_price: float
    observed_price: float
    normalized_threshold_price: str
    notification_status: Literal["pending", "sent", "failed"]
    attempt_count: int
    last_error: Optional[str]
    triggered_at: datetime
    sent_at: Optional[datetime]


class NotificationStatus(BaseModel):
    email_enabled: bool
    recipient_configured: bool
    smtp_configured: bool
    monitor_configured: bool
    monitor_running: bool
    poll_seconds: int
    provider_name: str
    last_monitor_cycle_at: Optional[datetime]
    last_price_refresh_at: Optional[datetime]
    last_monitor_error: Optional[str]
    latest_email_status: Optional[Literal["pending", "sent", "failed"]]
    latest_email_at: Optional[datetime]


class ChecklistAnswerBatch(BaseModel):
    answers: dict[str, bool]


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
    next_actions: list[str] = Field(default_factory=list)
    ui_hints: dict[str, Any] = Field(default_factory=dict)
    requires_acknowledgement: bool = False
    dismissible: bool = False
    dismissal_key: Optional[str] = None
    occurrence_key: Optional[str] = None


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
    next_actions: list[str] = Field(default_factory=list)
    ui_hints: dict[str, Any] = Field(default_factory=dict)
    requires_acknowledgement: bool = False
    priority: int = 0
    dedupe_group: Optional[str] = None
    suppresses: list[str] = Field(default_factory=list)
    avoid: str
    discipline_sentence: str
    enabled: bool


class RuleEvaluationResult(BaseModel):
    status: Literal["allowed", "warning", "blocked"]
    alerts: list[RuleAlert]


class QuoteRefreshError(BaseModel):
    symbol: str
    message: str


class QuoteRefreshResult(BaseModel):
    trades: list[TradeRead]
    errors: list[QuoteRefreshError]
    source: Literal["finnhub", "manual"]


class QuoteResult(BaseModel):
    symbol: str
    price: Optional[float]
    source: str
    fetched_at: datetime
    message: Optional[str] = None


class OpenTradeAttention(BaseModel):
    trade: TradeRead
    current_r: Optional[float]
    status: Literal["allowed", "warning", "blocked"]
    primary_alert: Optional[RuleAlert]
    alerts: list[RuleAlert]


class AttentionItem(BaseModel):
    id: str
    source_type: Literal[
        "trade_rule", "missing_position_size", "missing_stop",
        "runner_unprotected", "profit_milestone", "green_to_red",
        "failed_email", "pending_review",
        "notification_configuration",
        "accounting_inconsistency", "incomplete_position_accounting",
    ]
    severity: Literal["blocker", "warning", "reminder"]
    title: str
    message: str
    required_action: str
    trade_id: Optional[int] = None
    symbol: Optional[str] = None
    trade_horizon: Optional[TradeHorizon] = None
    current_r: Optional[float] = None
    detected_at: datetime
    destination_page: Literal["dashboard", "open-trades", "post-trade-review"]
    destination_context: dict[str, str] = Field(default_factory=dict)
    time_sensitive: bool = False
    dismissible: bool = False
    dismissal_key: Optional[str] = None
    occurrence_key: Optional[str] = None
    source_id: Optional[str] = None
    rule_id: Optional[str] = None


class AttentionCounts(BaseModel):
    blocker: int
    warning: int
    reminder: int


class AttentionResponse(BaseModel):
    items: list[AttentionItem]
    actionable_count: int
    counts: AttentionCounts


class WarningDismissalCreate(BaseModel):
    dismissal_key: str = Field(min_length=1, max_length=192)
    occurrence_key: str = Field(min_length=1, max_length=192)


class WarningDismissalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    dismissal_key: str
    occurrence_key: str
    dismissed_at: datetime


class WorkflowEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    trade_id: Optional[int]
    readiness_date: Optional[date]
    rule_id: Optional[str]
    severity: Optional[str]
    idempotency_key: Optional[str]
    event_data: dict[str, Any]
    occurred_at: datetime
    created_at: datetime


class AnalyticsPreparation(BaseModel):
    readiness_days_recorded: int
    readiness_days_cleared: int
    readiness_completion_rate: Optional[float] = Field(description="Cleared / recorded readiness days; null when no days are recorded.")
    average_required_items_completed: Optional[float] = Field(description="Null when no readiness days are recorded.")


class AnalyticsPlanningQuality(BaseModel):
    plans_created: int
    blocked_plan_attempts: int
    warning_finalization_attempts: int
    percent_plans_with_valid_stop: Optional[float] = Field(description="Valid-stop plans / plans created; null when no plans exist.")
    percent_plans_with_position_size: Optional[float] = Field(description="Positive-size plans / plans created; null when no plans exist.")
    average_planned_risk_reward: Optional[float] = Field(description="Null when no valid positive-reward plan exists.")
    average_total_planned_risk: Optional[float] = Field(description="Null when no valid sized plan exists.")


class AnalyticsExecutionDiscipline(BaseModel):
    trades_opened: int
    trades_with_partial_exits: int
    partial_exit_rate: Optional[float] = Field(description="Opened trades with partial exits / opened trades; null when none opened.")
    trades_with_runner_activated: int
    runner_without_stop_occurrences: int
    green_to_red_warning_occurrences: int
    average_number_of_exit_executions: Optional[float] = Field(description="Exit executions / opened trades; null when none opened.")
    auto_closed_trade_count: int
    trades_with_additions: int
    position_addition_rate: Optional[float]
    total_add_executions: int
    average_adds_per_trade_with_additions: Optional[float]
    adds_while_negative_count: int
    unconfirmed_reversal_adds_blocked: int


class AnalyticsReviewCompletion(BaseModel):
    closed_trades: int
    reviewed_trades: int
    review_completion_rate: Optional[float] = Field(description="Reviewed closed trades / closed trades; null when none closed.")
    median_close_to_review_minutes: Optional[float] = Field(description="Null when no selected closed trade has a review.")
    reviews_within_24_hours: int
    review_within_24_hours_rate: Optional[float] = Field(description="Reviews within 24 hours / reviewed closed trades; null when none reviewed.")
    pending_review_count: int


class AnalyticsNotificationReliability(BaseModel):
    threshold_events: int
    emails_sent: int
    emails_failed: int
    email_success_rate: Optional[float] = Field(description="Sent threshold emails / attempted threshold events; null when none attempted.")
    retry_exhausted_events: int
    latest_failure_at: Optional[datetime]


class AnalyticsFrequency(BaseModel):
    key: str
    count: int


class AnalyticsHorizonIssues(BaseModel):
    horizon: TradeHorizon
    issue_count: int


class AnalyticsRecurringIssues(BaseModel):
    most_frequent_mistake_tags: list[AnalyticsFrequency]
    most_frequent_blocking_rules: list[AnalyticsFrequency]
    most_frequent_warning_rules: list[AnalyticsFrequency]
    issue_breakdown_by_horizon: list[AnalyticsHorizonIssues]


class AnalyticsOutcomeContext(BaseModel):
    total_underlying_r: float
    average_underlying_r: Optional[float] = Field(description="Null when no selected closed trade has Final Underlying R.")
    median_underlying_r: Optional[float] = Field(description="Null when no selected closed trade has Final Underlying R.")
    average_discipline_score: Optional[float] = Field(description="Null when no selected reviewed trade has a discipline score.")


class DisciplineAnalytics(BaseModel):
    timezone: Literal["UTC"]
    date_from: Optional[date]
    date_to: Optional[date]
    trade_horizon: Optional[TradeHorizon]
    market: Optional[Market]
    setup: Optional[str]
    market_state: Optional[MarketState]
    trade_thesis: Optional[TradeThesis]
    entry_trigger: Optional[EntryTrigger]
    location_tag: Optional[LocationTag]
    preparation: AnalyticsPreparation
    planning_quality: AnalyticsPlanningQuality
    execution_discipline: AnalyticsExecutionDiscipline
    review_completion: AnalyticsReviewCompletion
    notification_reliability: AnalyticsNotificationReliability
    recurring_issues: AnalyticsRecurringIssues
    outcome_context: AnalyticsOutcomeContext


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


class DailyReadinessItem(BaseModel):
    id: str
    label: str
    required: bool
    completed: bool = False
    notes: str = ""
    category: str
    notes_placeholder: str = ""


class DailyReadinessUpdateItem(BaseModel):
    id: str
    completed: bool
    notes: str = ""


class DailyReadinessUpdate(BaseModel):
    items: list[DailyReadinessUpdateItem]
    notes: Optional[str] = None


class DailyReadinessRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    readiness_date: date
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: list[DailyReadinessItem]
    notes: Optional[str] = None
    required_complete_count: int
    required_total_count: int
    is_cleared_for_intraday: bool
    status: ReadinessStatus


class ChecklistAnswerCreate(BaseModel):
    trade_id: int
    question_key: str
    answer: bool
    notes: Optional[str] = None


class ChecklistAnswerRead(ChecklistAnswerCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
