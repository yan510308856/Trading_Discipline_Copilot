import { describe, expect, it } from "vitest";

import type { Trade } from "../types";
import { filterAndSortReviewTrades } from "./reviewFilters";

function closedTrade(
  id: number,
  closedAt: string,
  hasReview: boolean,
): Trade {
  return {
    id,
    status: "closed",
    closed_at: closedAt,
    updated_at: closedAt,
    has_review: hasReview,
  } as Trade;
}

const trades = [
  closedTrade(1, "2026-07-06T12:00:00Z", false),
  closedTrade(2, "2026-07-08T12:00:00Z", true),
  closedTrade(3, "2026-07-07T12:00:00Z", false),
];

describe("filterAndSortReviewTrades", () => {
  it("sorts all closed trades from newest to oldest by default", () => {
    const result = filterAndSortReviewTrades(trades, {
      reviewStatus: "all",
      startDate: "",
      endDate: "",
    });

    expect(result.map((trade) => trade.id)).toEqual([2, 3, 1]);
  });

  it("filters by review status", () => {
    const result = filterAndSortReviewTrades(trades, {
      reviewStatus: "pending",
      startDate: "",
      endDate: "",
    });

    expect(result.map((trade) => trade.id)).toEqual([3, 1]);
  });

  it("filters inclusively by the selected date range", () => {
    const result = filterAndSortReviewTrades(trades, {
      reviewStatus: "all",
      startDate: "2026-07-07",
      endDate: "2026-07-07",
    });

    expect(result.map((trade) => trade.id)).toEqual([3]);
  });
});
