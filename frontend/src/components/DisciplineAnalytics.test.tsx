import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { queryKeys } from "../hooks/queries";
import type { DisciplineAnalyticsData } from "../types";
import { DisciplineAnalytics } from "./DisciplineAnalytics";

const data: DisciplineAnalyticsData = {
  timezone: "UTC", date_from: null, date_to: null, trade_horizon: null, market: null, setup: null, market_state: null, trade_thesis: null, entry_trigger: null, location_tag: null,
  preparation: { readiness_days_recorded: 0, readiness_days_cleared: 0, readiness_completion_rate: null, average_required_items_completed: null },
  planning_quality: { plans_created: 0, blocked_plan_attempts: 0, warning_finalization_attempts: 0, percent_plans_with_valid_stop: null, percent_plans_with_position_size: null, average_planned_risk_reward: null, average_total_planned_risk: null },
  execution_discipline: { trades_opened: 0, trades_with_partial_exits: 0, partial_exit_rate: null, trades_with_runner_activated: 0, runner_without_stop_occurrences: 0, green_to_red_warning_occurrences: 0, average_number_of_exit_executions: null, auto_closed_trade_count: 0 },
  review_completion: { closed_trades: 0, reviewed_trades: 0, review_completion_rate: null, median_close_to_review_minutes: null, reviews_within_24_hours: 0, review_within_24_hours_rate: null, pending_review_count: 0 },
  notification_reliability: { threshold_events: 0, emails_sent: 0, emails_failed: 2, email_success_rate: null, retry_exhausted_events: 1, latest_failure_at: null },
  recurring_issues: { most_frequent_mistake_tags: [], most_frequent_blocking_rules: [], most_frequent_warning_rules: [], issue_breakdown_by_horizon: ["intraday", "swing", "leap", "other"].map((horizon) => ({ horizon: horizon as "intraday" | "swing" | "leap" | "other", issue_count: 0 })) },
  outcome_context: { total_underlying_r: 0, average_underlying_r: null, median_underlying_r: null, average_discipline_score: null },
};

describe("DisciplineAnalytics", () => {
  it("renders definitions, failures, null states, and underlying-R labels", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.analytics({}), data);
    const html = renderToString(<QueryClientProvider client={client}><DisciplineAnalytics /></QueryClientProvider>);
    expect(html).toContain("Reviewed closed trades / all closed trades");
    expect(html).toContain("Emails failed");
    expect(html).toContain("No recorded data");
    expect(html).toContain("Average Underlying R");
    expect(html).not.toContain("Option premium");
  });
});
