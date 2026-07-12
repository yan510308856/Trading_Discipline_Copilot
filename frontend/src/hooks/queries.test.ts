import { describe, expect, it } from "vitest";

import { QueryClient } from "@tanstack/react-query";
import { invalidateTradesAndSummary, queryKeys } from "./queries";

describe("query keys", () => {
  it("separates trade lists by status and horizon", () => {
    expect(queryKeys.trades("open", "swing")).toEqual([
      "trades",
      "open",
      "swing",
    ]);
  });

  it("separates daily summaries by date and horizon", () => {
    expect(queryKeys.dailySummary("2026-07-09", "intraday")).toEqual([
      "daily-summary",
      "2026-07-09",
      "intraday",
    ]);
  });

  it("invalidates trades, summary, Attention, and analytics after domain writes", async () => {
    const client = new QueryClient();
    const invalidated: unknown[] = [];
    client.invalidateQueries = ((filters: { queryKey?: unknown }) => {
      invalidated.push(filters.queryKey);
      return Promise.resolve();
    }) as typeof client.invalidateQueries;

    invalidateTradesAndSummary(client);

    expect(invalidated).toEqual([["trades"], ["daily-summary"], ["attention"], ["analytics"]]);
  });

  it("uses every analytics filter in a stable query key", () => {
    expect(queryKeys.analytics({ date_from: "2026-07-01", date_to: "2026-07-11", trade_horizon: "leap", market: "options", setup: "breakout" })).toEqual([
      "analytics",
      { date_from: "2026-07-01", date_to: "2026-07-11", trade_horizon: "leap", market: "options", setup: "breakout" },
    ]);
  });
});
