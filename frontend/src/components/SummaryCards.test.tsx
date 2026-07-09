import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DailySummaryData } from "../types";
import { SummaryCards } from "./SummaryCards";

const summary: DailySummaryData = {
  date: "2026-07-09",
  total_trades: 3,
  net_r: 1.25,
  average_discipline_score: 84,
  warning_violation_count: 2,
  green_to_red_count: 1,
  revenge_trade_count: 0,
  most_frequent_mistakes: [],
  lessons: [],
};

describe("SummaryCards", () => {
  it("renders the key metric grid", () => {
    const html = renderToString(<SummaryCards summary={summary} />);

    expect(html).toContain("summary-card-grid");
    expect(html).toContain("Net result");
    expect(html).toContain("+1.25R");
    expect(html).toContain("Average discipline");
  });
});
