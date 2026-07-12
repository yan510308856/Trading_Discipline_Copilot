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

  it("invalidates trades, summary, and Attention after domain writes", async () => {
    const client = new QueryClient();
    const invalidated: unknown[] = [];
    client.invalidateQueries = ((filters: { queryKey?: unknown }) => {
      invalidated.push(filters.queryKey);
      return Promise.resolve();
    }) as typeof client.invalidateQueries;

    invalidateTradesAndSummary(client);

    expect(invalidated).toEqual([["trades"], ["daily-summary"], ["attention"]]);
  });
});
