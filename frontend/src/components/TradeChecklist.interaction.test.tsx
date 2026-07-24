// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppQueryClient } from "../queryClient";
import { TradeChecklist } from "./TradeChecklist";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("/rules/evaluate")
      ? { status: "allowed", alerts: [] }
      : {
          id: null, readiness_date: "2026-07-24", created_at: null, updated_at: null,
          items: [], notes: null, required_complete_count: 0, required_total_count: 0,
          is_cleared_for_intraday: true, status: "cleared",
        };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TradeChecklist interactions", () => {
  it("plans an option contract in Step 1 and removes it from Key Locations", () => {
    render(<QueryClientProvider client={createAppQueryClient()}><TradeChecklist /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText(/Symbol/), { target: { value: "AAPL" } });
    fireEvent.click(screen.getByRole("button", { name: "options" }));

    expect(screen.getByText("Contract details")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Call" }));
    fireEvent.change(screen.getByLabelText("Expiration date"), { target: { value: "2027-01-15" } });
    fireEvent.change(screen.getByLabelText("Strike"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Price Action Classification")).toBeTruthy();
    expect(screen.queryByText("Contract details")).toBeNull();
  });
});
