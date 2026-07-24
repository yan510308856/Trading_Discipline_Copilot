export type PageId =
  | "dashboard"
  | "trade-checklist"
  | "attention"
  | "open-trades"
  | "post-trade-review"
  | "daily-summary"
  | "discipline-analytics"
  | "rules-library";

export interface NavigationItem {
  id: PageId;
  label: string;
  shortLabel: string;
  icon: string;
}

export interface HealthResponse {
  status: "ok";
}

export interface MistakeFrequency {
  tag: string;
  count: number;
}

export interface DailySummaryData {
  date: string;
  total_trades: number;
  net_r: number;
  average_discipline_score: number | null;
  warning_violation_count: number;
  green_to_red_count: number;
  revenge_trade_count: number;
  most_frequent_mistakes: MistakeFrequency[];
  lessons: string[];
}

export interface AnalyticsFilters {
  date_from?: string;
  date_to?: string;
  trade_horizon?: TradeHorizon;
  market?: Market;
  setup?: string;
  market_state?: MarketState;
  trade_thesis?: TradeThesis;
  entry_trigger?: EntryTrigger;
  location_tag?: LocationTag;
}

export interface AnalyticsFrequency { key: string; count: number; }
export interface AnalyticsHorizonIssues { horizon: TradeHorizon; issue_count: number; }

export interface DisciplineAnalyticsData {
  timezone: "UTC";
  date_from: string | null;
  date_to: string | null;
  trade_horizon: TradeHorizon | null;
  market: Market | null;
  setup: string | null;
  market_state: MarketState | null;
  trade_thesis: TradeThesis | null;
  entry_trigger: EntryTrigger | null;
  location_tag: LocationTag | null;
  preparation: {
    readiness_days_recorded: number;
    readiness_days_cleared: number;
    readiness_completion_rate: number | null;
    average_required_items_completed: number | null;
  };
  planning_quality: {
    plans_created: number;
    blocked_plan_attempts: number;
    warning_finalization_attempts: number;
    percent_plans_with_valid_stop: number | null;
    percent_plans_with_position_size: number | null;
    average_planned_risk_reward: number | null;
    average_total_planned_risk: number | null;
  };
  execution_discipline: {
    trades_opened: number;
    trades_with_partial_exits: number;
    partial_exit_rate: number | null;
    trades_with_runner_activated: number;
    runner_without_stop_occurrences: number;
    green_to_red_warning_occurrences: number;
    average_number_of_exit_executions: number | null;
    auto_closed_trade_count: number;
  };
  review_completion: {
    closed_trades: number;
    reviewed_trades: number;
    review_completion_rate: number | null;
    median_close_to_review_minutes: number | null;
    reviews_within_24_hours: number;
    review_within_24_hours_rate: number | null;
    pending_review_count: number;
  };
  notification_reliability: {
    threshold_events: number;
    emails_sent: number;
    emails_failed: number;
    email_success_rate: number | null;
    retry_exhausted_events: number;
    latest_failure_at: string | null;
  };
  recurring_issues: {
    most_frequent_mistake_tags: AnalyticsFrequency[];
    most_frequent_blocking_rules: AnalyticsFrequency[];
    most_frequent_warning_rules: AnalyticsFrequency[];
    issue_breakdown_by_horizon: AnalyticsHorizonIssues[];
  };
  outcome_context: {
    total_underlying_r: number;
    average_underlying_r: number | null;
    median_underlying_r: number | null;
    average_discipline_score: number | null;
  };
}

export type DailyReadinessStatus =
  | "not_cleared"
  | "partially_ready"
  | "cleared";

export interface DailyReadinessItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
  notes: string;
  category: string;
  notes_placeholder: string;
}

export interface DailyReadinessData {
  id: number | null;
  readiness_date: string;
  created_at: string | null;
  updated_at: string | null;
  items: DailyReadinessItem[];
  notes: string | null;
  required_complete_count: number;
  required_total_count: number;
  is_cleared_for_intraday: boolean;
  status: DailyReadinessStatus;
}

export interface DailyReadinessUpdatePayload {
  items: Array<{
    id: string;
    completed: boolean;
    notes: string;
  }>;
  notes: string | null;
}

export type ConnectionState = "checking" | "connected" | "unavailable";

export type Market =
  | "stocks"
  | "options"
  | "futures"
  | "other"
  | "crypto"
  | "forex";

export type Direction = "long" | "short";
export type TradeHorizon = "swing" | "intraday" | "leap" | "other";
export type MarketState = "strong_trend" | "narrow_channel" | "broad_channel" | "trading_range" | "breakout_mode" | "unclear";
export type TradeThesis = "pullback_continuation" | "breakout" | "breakout_pullback" | "failed_breakout" | "range_reversal" | "major_reversal" | "other";
export type EntryTrigger = "h1_h2_l1_l2" | "second_entry" | "wedge" | "double_top_bottom" | "inside_bar_triangle" | "strong_signal_bar" | "breakout_retest" | "other";
export type LocationTag = "opening_range" | "gap_open" | "range_high" | "range_low" | "prior_day_high" | "prior_day_low" | "support" | "resistance" | "pullback_zone" | "breakout_point";
export type LocationDecision = "selected" | "none";
export type ReversalConfirmation = "confirmed" | "unconfirmed";
export type FollowedPlan = "yes" | "partial" | "no";
export type RuleStatus = "allowed" | "warning" | "blocked";
export type RuleSeverity = "blocker" | "warning" | "reminder";
export type RuleStage = "pre_trade" | "in_trade" | "post_trade";

export interface RuleDefinition {
  id: string;
  name: string;
  category: string;
  stage: RuleStage;
  severity: RuleSeverity;
  trigger: Record<string, unknown>;
  conditions: Array<Record<string, unknown>>;
  message: string;
  checklist: string[];
  next_actions?: string[];
  ui_hints?: Record<string, unknown>;
  requires_acknowledgement?: boolean;
  avoid: string;
  discipline_sentence: string;
  enabled: boolean;
}

export interface TradeFormState {
  symbol: string;
  option_contract: string;
  option_type: "call" | "put" | null;
  option_expiration: string;
  option_strike: string;
  option_entry_price: string;
  trade_horizon: TradeHorizon;
  market: Market;
  direction: Direction;
  setup: string;
  market_context: string;
  market_state: MarketState | "";
  trade_thesis: TradeThesis | "";
  entry_trigger: EntryTrigger | "";
  location_tags: LocationTag[];
  location_decision: LocationDecision | null;
  reversal_confirmation: ReversalConfirmation | null;
  is_unconfirmed_reversal: boolean;
  planned_entry: string;
  stop_loss: string;
  target_1: string;
  target_2: string;
  runner_enabled: boolean;
  position_size: string;
  notes: string;
  follow_through_confirmed: boolean;
  recent_stop_loss: boolean;
  is_immediate_reverse: boolean;
  second_leg_entry: boolean;
  big_bar_entry: boolean;
}

export interface TradeCreatePayload {
  symbol: string;
  option_contract: string | null;
  option_type: "call" | "put" | null;
  option_expiration: string | null;
  option_strike: number | null;
  option_entry_price: number | null;
  trade_horizon: TradeHorizon;
  market: Market;
  direction: Direction;
  setup: string;
  market_context: string;
  market_state: MarketState;
  trade_thesis: TradeThesis;
  entry_trigger: EntryTrigger;
  location_tags: LocationTag[];
  location_decision: LocationDecision;
  reversal_confirmation: ReversalConfirmation | null;
  is_unconfirmed_reversal: boolean;
  planned_entry: number;
  stop_loss: number;
  target_1: number;
  target_2: number | null;
  runner_enabled: boolean;
  position_size: number;
  notes: string | null;
}

export interface Trade extends Omit<TradeCreatePayload, "position_size" | "location_decision"> {
  id: number;
  status: "planned" | "open" | "closed" | "cancelled";
  created_at: string;
  updated_at: string;
  opened_at: string | null;
  closed_at: string | null;
  actual_entry: number | null;
  current_stop: number | null;
  current_price: number | null;
  current_price_source: string | null;
  current_price_updated_at: string | null;
  position_size: number | null;
  location_decision: LocationDecision | null;
  option_current_price: number | null;
  runner_active: boolean;
  runner_stop: number | null;
  partial_taken: boolean;
  partial_exit_quantity: number;
  exit_price: number | null;
  exit_reason: string | null;
  final_r: number | null;
  mfe_r: number | null;
  mae_r: number | null;
  followed_plan: FollowedPlan | null;
  discipline_score: number | null;
  has_review: boolean;
  review: Review | null;
  executions: TradeExecution[];
}

export interface QuoteResult {
  symbol: string;
  price: number | null;
  source: string;
  fetched_at: string;
  message: string | null;
}

export interface TradeExecution {
  id: number;
  trade_id: number;
  executed_at: string;
  execution_type: "partial" | "final";
  price: number;
  quantity: number | null;
  exit_reason: ExitReason | null;
  option_price: number | null;
}

export type ExitReason =
  | "partial_profit" | "target_hit" | "stop_hit" | "runner_stop"
  | "risk_reduction" | "invalidated_setup" | "time_exit" | "manual_exit" | "other";

export interface TradePatchPayload {
  trade_horizon?: TradeHorizon;
  current_stop?: number | null;
  current_price?: number | null;
  option_current_price?: number | null;
  option_entry_price?: number | null;
  target_1?: number;
  target_2?: number | null;
  runner_enabled?: boolean;
  runner_active?: boolean;
  runner_stop?: number | null;
  position_size?: number | null;
  notes?: string | null;
  market_state?: MarketState;
  trade_thesis?: TradeThesis;
  entry_trigger?: EntryTrigger;
  location_tags?: LocationTag[];
  location_decision?: LocationDecision;
  reversal_confirmation?: ReversalConfirmation | null;
  is_unconfirmed_reversal?: boolean;
}

export interface TradeFilters {
  market_state?: MarketState;
  trade_thesis?: TradeThesis;
  entry_trigger?: EntryTrigger;
  location_tag?: LocationTag;
}

export interface TradeClosePayload {
  exit_price: number;
  exit_reason: string;
}

export interface NotificationStatus {
  email_enabled: boolean;
  recipient_configured: boolean;
  smtp_configured: boolean;
  monitor_configured: boolean;
  monitor_running: boolean;
  poll_seconds: number;
  provider_name: string;
  last_monitor_cycle_at: string | null;
  last_price_refresh_at: string | null;
  last_monitor_error: string | null;
  latest_email_status: "pending" | "sent" | "failed" | null;
  latest_email_at: string | null;
}

export interface PriceAlertEvent {
  id: number;
  trade_id: number;
  alert_kind: "target_1" | "target_2" | "stop";
  threshold_price: number;
  observed_price: number;
  normalized_threshold_price: string;
  notification_status: "pending" | "sent" | "failed";
  attempt_count: number;
  last_error: string | null;
  triggered_at: string;
  sent_at: string | null;
}

export interface ReviewPayload {
  followed_plan: FollowedPlan;
  mistake_tags: string[];
  positive_actions: string[];
  lesson: string | null;
  notes: string | null;
}

export type TradeClassification =
  | "good_trade_winner"
  | "good_trade_loser"
  | "bad_trade_winner"
  | "bad_trade_loser";

export interface Review extends ReviewPayload {
  id: number;
  trade_id: number;
  created_at: string;
  discipline_score: number;
  score_band: string;
  triggered_rules: string[];
  veto_reason: string | null;
  trade_classification: TradeClassification;
}

export interface RuleAlert {
  rule_id: string;
  severity: RuleSeverity;
  message: string;
  checklist: string[];
  discipline_sentence: string;
  next_actions?: string[];
  ui_hints?: Record<string, unknown>;
  requires_acknowledgement?: boolean;
  dismissible?: boolean;
  dismissal_key?: string | null;
  occurrence_key?: string | null;
}

export interface RuleEvaluationResult {
  status: RuleStatus;
  alerts: RuleAlert[];
}

export interface QuoteRefreshResult {
  trades: Trade[];
  errors: Array<{ symbol: string; message: string }>;
  source: "finnhub" | "manual";
}

export interface OpenTradeAttention {
  trade: Trade;
  current_r: number | null;
  status: RuleStatus;
  primary_alert: RuleAlert | null;
  alerts: RuleAlert[];
}

export type AttentionSeverity = "blocker" | "warning" | "reminder";
export type AttentionSourceType =
  | "trade_rule" | "missing_position_size" | "missing_stop"
  | "runner_unprotected" | "profit_milestone" | "green_to_red"
  | "failed_email" | "pending_review"
  | "notification_configuration";

export interface AttentionItem {
  id: string;
  source_type: AttentionSourceType;
  severity: AttentionSeverity;
  title: string;
  message: string;
  required_action: string;
  trade_id: number | null;
  symbol: string | null;
  trade_horizon: TradeHorizon | null;
  current_r: number | null;
  detected_at: string;
  destination_page: "dashboard" | "open-trades" | "post-trade-review";
  destination_context: Record<string, string>;
  time_sensitive: boolean;
  dismissible: boolean;
  dismissal_key: string | null;
  occurrence_key: string | null;
}

export interface AttentionResponse {
  items: AttentionItem[];
  actionable_count: number;
  counts: Record<AttentionSeverity, number>;
}

export interface APIErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}
