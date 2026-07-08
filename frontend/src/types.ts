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
