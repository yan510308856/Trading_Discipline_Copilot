import { describe, expect, it } from "vitest";

import { queryKeys } from "./queries";

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
});
