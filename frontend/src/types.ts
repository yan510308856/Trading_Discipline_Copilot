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

export type ConnectionState = "checking" | "connected" | "unavailable";

export type Market =
  | "futures"
  | "stocks"
  | "crypto"
  | "forex"
  | "options"
  | "other";

export type Direction = "long" | "short";
export type RuleStatus = "allowed" | "warning" | "blocked";
export type RuleSeverity = "blocker" | "warning" | "reminder";

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
