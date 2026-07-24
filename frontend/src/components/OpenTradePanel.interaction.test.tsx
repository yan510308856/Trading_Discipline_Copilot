// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { createAppQueryClient } from "../queryClient";
import type { Trade } from "../types";
import { OpenTradePanel } from "./OpenTradePanel";

const trade: Trade = {
  id: 1, symbol: "AAPL", market: "stocks", direction: "long",
  trade_horizon: "swing", setup: "pullback", market_context: "strong_trend",
  market_state: "strong_trend", trade_thesis: "pullback_continuation",
  entry_trigger: "second_entry", location_tags: ["support"],
  location_decision: "selected", reversal_confirmation: "confirmed",
  is_unconfirmed_reversal: false, planned_entry: 100, actual_entry: 100,
  stop_loss: 95, current_stop: 95, current_price: 105,
  current_price_source: "manual", current_price_updated_at: "2026-07-24T12:00:00Z",
  target_1: 115, target_2: null, runner_enabled: false, runner_active: false,
  runner_stop: null, position_size: 2, notes: null, option_contract: null,
  option_type: null, option_expiration: null, option_strike: null,
  option_entry_price: null, option_current_price: null,
  status: "open", created_at: "2026-07-24T09:00:00Z",
  updated_at: "2026-07-24T12:00:00Z", opened_at: "2026-07-24T10:00:00Z",
  closed_at: null, partial_taken: false, partial_exit_quantity: 0,
  exit_price: null, exit_reason: null, final_r: null, mfe_r: 1, mae_r: 0,
  followed_plan: null, discipline_score: null, has_review: false, review: null,
  executions: [],
  entry_executions: [
    { id: 1, trade_id: 1, executed_at: "2026-07-24T10:00:00Z", entry_kind: "initial", underlying_price: 100, quantity: 2, stop_at_entry: 95, option_price: null, reason: "initial_plan", notes: null, created_at: "2026-07-24T10:00:00Z" },
  ],
  position_summary: {
    initial_quantity: 2, added_quantity: 0, total_entry_quantity: 2,
    total_exit_quantity: 0, remaining_quantity: 2,
    weighted_average_entry: 100, total_underlying_risk: 10,
    add_count: 0, uses_legacy_fallback: false, accounting_consistent: true,
  },
};

function response(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
}

let listedTrade = trade;

beforeEach(() => {
  listedTrade = trade;
  window.location.hash = "#open-trades?trade_id=1";
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/rules/evaluate")) return response({ status: "allowed", alerts: [] });
    if (url.includes("/price-alert-events")) return response([]);
    if (url.endsWith("/horizon")) {
      listedTrade = { ...listedTrade, trade_horizon: "intraday" };
      return response(listedTrade);
    }
    if (url.endsWith("/entries") && init?.method === "POST") {
      const submitted = JSON.parse(String(init.body)) as {
        stop_at_entry: number;
      };
      listedTrade = {
        ...listedTrade,
        current_stop: submitted.stop_at_entry,
        entry_executions: [
          ...listedTrade.entry_executions,
          { ...listedTrade.entry_executions[0], id: 2, entry_kind: "add", underlying_price: 105, quantity: 1, stop_at_entry: submitted.stop_at_entry, reason: "breakout_confirmation" },
        ],
        position_summary: {
          ...listedTrade.position_summary, added_quantity: 1, total_entry_quantity: 3,
          remaining_quantity: 3, weighted_average_entry: 101.6667,
          total_underlying_risk: 20, add_count: 1,
        },
      };
      return response(listedTrade);
    }
    return response([listedTrade]);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("confirms horizon changes and records additions without auto-submitting defaults", async () => {
  render(<QueryClientProvider client={createAppQueryClient()}><OpenTradePanel /></QueryClientProvider>);
  expect(await screen.findByText("Add to Position")).toBeTruthy();
  for (const sectionName of [
    "Record Exit Execution",
    "Add to Position",
    "Execution History",
    "Price Alert History",
  ]) {
    const section = screen.getByText(sectionName).closest("details");
    expect(section?.classList.contains("trade-management-accordion")).toBe(true);
    expect(section?.hasAttribute("open")).toBe(false);
  }

  fireEvent.click(screen.getByRole("button", { name: "Edit horizon for AAPL" }));
  fireEvent.change(screen.getByLabelText("Change horizon for AAPL"), { target: { value: "intraday" } });
  expect(screen.getByText("swing → intraday")).toBeTruthy();
  expect(screen.getByText(/Daily Readiness applies when creating/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Edit horizon for AAPL" }).textContent).toBe("intraday");
  });

  expect((screen.getByLabelText("Add underlying price") as HTMLInputElement).value).toBe("105.00");
  expect((screen.getByLabelText("Stop at add") as HTMLInputElement).value).toBe("95.00");
  fireEvent.change(screen.getByLabelText("Add quantity"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Stop at add"), { target: { value: "99" } });
  expect(screen.getAllByText("3.00").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Review Add" }));
  expect(screen.getByRole("heading", { name: "Add to AAPL?" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm Add" }));
  expect(await screen.findByText("Position addition recorded locally. No broker order was placed.")).toBeTruthy();
  expect(screen.getByText("Current stop").parentElement?.textContent).toContain("99.00");
  expect((screen.getByLabelText("Stop at add") as HTMLInputElement).value).toBe("99.00");
});
