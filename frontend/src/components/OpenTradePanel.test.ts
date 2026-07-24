import { describe, expect, it } from "vitest";

import type { Trade } from "../types";
import {
  robinhoodUrl,
  sortActiveTrades,
  tradingViewUrl,
} from "./OpenTradePanel";

describe("tradingViewUrl", () => {
  it("opens the TradingView chart for a normalized symbol", () => {
    expect(tradingViewUrl(" spy ")).toBe(
      "https://www.tradingview.com/chart/?symbol=SPY",
    );
  });

  it("opens Robinhood for a normalized symbol", () => {
    expect(robinhoodUrl(" ups ")).toBe("https://robinhood.com/stocks/UPS");
  });
});

function sortableTrade(
  id: number,
  symbol: string,
  currentPrice: number | null,
  openedAt: string,
): Trade {
  return {
    id,
    symbol,
    status: "open",
    market: "stocks",
    direction: "long",
    planned_entry: 100,
    actual_entry: 100,
    stop_loss: 95,
    current_price: currentPrice,
    opened_at: openedAt,
    created_at: openedAt,
    entry_executions: [],
    executions: [],
  } as unknown as Trade;
}

describe("sortActiveTrades", () => {
  const trades = [
    sortableTrade(1, "ZZZ", 105, "2026-07-22T10:00:00Z"),
    sortableTrade(2, "AAA", 110, "2026-07-23T10:00:00Z"),
    sortableTrade(3, "MMM", null, "2026-07-24T10:00:00Z"),
  ];

  it("ranks by open time, name, or current R", () => {
    expect(sortActiveTrades(trades, "opened").map((trade) => trade.symbol))
      .toEqual(["MMM", "AAA", "ZZZ"]);
    expect(sortActiveTrades(trades, "symbol").map((trade) => trade.symbol))
      .toEqual(["AAA", "MMM", "ZZZ"]);
    expect(sortActiveTrades(trades, "current_r").map((trade) => trade.symbol))
      .toEqual(["AAA", "ZZZ", "MMM"]);
  });
});
