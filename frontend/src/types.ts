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

export type ConnectionState = "checking" | "connected" | "unavailable";

export type Market =
  | "futures"
  | "stocks"
  | "crypto"
  | "forex"
  | "options"
  | "other";

export type Direction = "long" | "short";
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
  avoid: string;
  discipline_sentence: string;
  enabled: boolean;
}

export interface TradeFormState {
  symbol: string;
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
  followed_plan: FollowedPlan | null;
  discipline_score: number | null;
  has_review: boolean;
  review: Review | null;
}

export interface TradePatchPayload {
  current_stop?: number | null;
  current_price?: number | null;
  runner_enabled?: boolean;
  runner_active?: boolean;
  runner_stop?: number | null;
  partial_taken?: boolean;
  partial_exit_quantity?: number;
  notes?: string | null;
}

export interface TradeClosePayload {
  exit_price: number;
  exit_reason: string;
}

export interface ReviewPayload {
  exit_price: number;
  exit_reason: string;
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

export interface Review extends Omit<ReviewPayload, "exit_price" | "exit_reason"> {
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
}

export interface RuleEvaluationResult {
  status: RuleStatus;
  alerts: RuleAlert[];
}

export interface APIErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}
