import { describe, expect, it } from "vitest";

import type { DailyReadinessData, TradeFormState } from "../types";
import {
  buildLocalTradeAlerts,
  isCreateTradePlanDisabled,
  statusFromAlerts,
} from "./tradePlanGate";

const readyEnoughForm: TradeFormState = {
  symbol: "ES",
  option_contract: "",
  option_type: null,
  option_expiration: "",
  option_strike: "",
  option_entry_price: "",
  trade_horizon: "intraday",
  market: "futures",
  direction: "long",
  setup: "breakout",
  market_context: "strong_trend",
  market_state: "strong_trend",
  trade_thesis: "breakout",
  entry_trigger: "other",
  location_tags: [],
  is_unconfirmed_reversal: false,
  planned_entry: "5000",
  stop_loss: "4990",
  target_1: "5020",
  target_2: "",
  runner_enabled: false,
  position_size: "",
  notes: "",
  follow_through_confirmed: false,
  recent_stop_loss: false,
  is_immediate_reverse: false,
  second_leg_entry: false,
  big_bar_entry: false,
};

const incompleteReadiness: DailyReadinessData = {
  id: 1,
  readiness_date: "2026-07-09",
  created_at: "2026-07-09T09:00:00Z",
  updated_at: "2026-07-09T09:00:00Z",
  items: [],
  notes: null,
  required_complete_count: 2,
  required_total_count: 5,
  is_cleared_for_intraday: false,
  status: "partially_ready",
};

describe("trade plan readiness gate", () => {
  it("blocks intraday trade creation when daily readiness is incomplete", () => {
    const alerts = buildLocalTradeAlerts(readyEnoughForm, null, incompleteReadiness);

    expect(alerts.map((alert) => alert.rule_id)).toContain(
      "daily_intraday_readiness_required",
    );
    expect(statusFromAlerts(alerts)).toBe("blocked");
    expect(isCreateTradePlanDisabled("blocked", false, false, false, false)).toBe(true);
  });

  it("does not block swing trades when daily readiness is incomplete", () => {
    const alerts = buildLocalTradeAlerts(
      { ...readyEnoughForm, trade_horizon: "swing" },
      null,
      incompleteReadiness,
    );

    expect(alerts.map((alert) => alert.rule_id)).not.toContain(
      "daily_intraday_readiness_required",
    );
    expect(statusFromAlerts(alerts)).toBe("allowed");
  });
});
