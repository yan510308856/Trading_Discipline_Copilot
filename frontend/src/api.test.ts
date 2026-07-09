import { afterEach, describe, expect, it, vi } from "vitest";

import { getDailySummary, getTrades } from "./api";

function mockJsonResponse(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("api query parameters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests trades with status and horizon filters", async () => {
    const fetchMock = vi.fn(() => mockJsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await getTrades("open", "swing");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trades?limit=500&status=open&trade_horizon=swing",
      expect.any(Object),
    );
  });

  it("requests daily summary with date and horizon filters", async () => {
    const fetchMock = vi.fn(() =>
      mockJsonResponse({
        date: "2026-07-09",
        total_trades: 0,
        net_r: 0,
        average_discipline_score: null,
        warning_violation_count: 0,
        green_to_red_count: 0,
        revenge_trade_count: 0,
        most_frequent_mistakes: [],
        lessons: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getDailySummary("2026-07-09", "intraday");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/summary/daily?date=2026-07-09&trade_horizon=intraday",
      expect.any(Object),
    );
  });
});
