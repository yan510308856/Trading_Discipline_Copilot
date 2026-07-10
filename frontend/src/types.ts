export type PageId =
  | "dashboard"
  | "trade-checklist"
  | "rule-alerts"
  | "open-trades"
  | "post-trade-review"
  | "daily-summary"
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
  trade_horizon: TradeHorizon;
  market: Market;
  direction: Direction;
  setup: string;
  market_context: string;
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
  trade_horizon: TradeHorizon;
  market: Market;
  direction: Direction;
  setup: string;
  market_context: string;
  planned_entry: number;
  stop_loss: number;
  target_1: number;
  target_2: number | null;
  runner_enabled: boolean;
  position_size: number | null;
  notes: string | null;
}

export interface Trade extends TradeCreatePayload {
  id: number;
  status: "planned" | "open" | "closed" | "cancelled";
  created_at: string;
  updated_at: string;
  opened_at: string | null;
  closed_at: string | null;
  actual_entry: number | null;
  current_stop: number | null;
  current_price: number | null;
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
}

export interface TradePatchPayload {
  trade_horizon?: TradeHorizon;
  current_stop?: number | null;
  current_price?: number | null;
  target_1?: number;
  target_2?: number | null;
  runner_enabled?: boolean;
  runner_active?: boolean;
  runner_stop?: number | null;
  position_size?: number | null;
  notes?: string | null;
}

export interface TradeClosePayload {
  exit_price: number;
  exit_reason: string;
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

export interface APIErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}
