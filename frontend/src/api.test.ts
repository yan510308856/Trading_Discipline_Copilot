import { afterEach, describe, expect, it, vi } from "vitest";

import { addPosition, changeTradeHorizon, getAttention, getDailySummary, getDisciplineAnalytics, getTrades } from "./api";

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

  it("requests trades with structured classification filters", async () => {
    const fetchMock = vi.fn(() => mockJsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    await getTrades("planned", "swing", { market_state: "narrow_channel", trade_thesis: "pullback_continuation", entry_trigger: "wedge", location_tag: "support" });
    expect(fetchMock).toHaveBeenCalledWith("/api/trades?limit=500&status=planned&trade_horizon=swing&market_state=narrow_channel&trade_thesis=pullback_continuation&entry_trigger=wedge&location_tag=support", expect.any(Object));
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

  it("requests attention with a horizon filter", async () => {
    const fetchMock = vi.fn(() => mockJsonResponse({ items: [], actionable_count: 0, counts: { blocker: 0, warning: 0, reminder: 0 } }));
    vi.stubGlobal("fetch", fetchMock);
    await getAttention("leap");
    expect(fetchMock).toHaveBeenCalledWith("/api/attention?trade_horizon=leap", expect.any(Object));
  });

  it("requests analytics with date, horizon, market, and setup filters", async () => {
    const fetchMock = vi.fn(() => mockJsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    await getDisciplineAnalytics({ date_from: "2026-07-01", date_to: "2026-07-11", trade_horizon: "leap", market: "options", setup: "breakout" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/discipline?date_from=2026-07-01&date_to=2026-07-11&trade_horizon=leap&market=options&setup=breakout",
      expect.any(Object),
    );
  });

  it("uses dedicated audited horizon and add-position endpoints", async () => {
    const fetchMock = vi.fn(() => mockJsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    await changeTradeHorizon(7, "leap");
    await addPosition(7, {
      underlying_price: 105,
      quantity: 1,
      stop_at_entry: 100,
      reason: "breakout_confirmation",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/trades/7/horizon",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ trade_horizon: "leap" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/trades/7/entries",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
