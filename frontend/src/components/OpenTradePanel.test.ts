import { describe, expect, it } from "vitest";

import { robinhoodUrl, tradingViewUrl } from "./OpenTradePanel";

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
