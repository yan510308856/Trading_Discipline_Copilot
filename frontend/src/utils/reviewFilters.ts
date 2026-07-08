import type { Trade } from "../types";

export type ReviewFilter = "all" | "pending" | "reviewed";

export interface ReviewFilters {
  reviewStatus: ReviewFilter;
  startDate: string;
  endDate: string;
}

function localDateKey(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tradeSortTime(trade: Trade): number {
  return new Date(trade.closed_at ?? trade.updated_at).getTime();
}

export function filterAndSortReviewTrades(
  trades: Trade[],
  filters: ReviewFilters,
): Trade[] {
  return trades
    .filter((trade) => {
      if (filters.reviewStatus === "pending" && trade.has_review) return false;
      if (filters.reviewStatus === "reviewed" && !trade.has_review) return false;

      const dateKey = localDateKey(trade.closed_at ?? trade.updated_at);
      if (filters.startDate && dateKey < filters.startDate) return false;
      if (filters.endDate && dateKey > filters.endDate) return false;
      return true;
    })
    .sort((left, right) => tradeSortTime(right) - tradeSortTime(left));
}
