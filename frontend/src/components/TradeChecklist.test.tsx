import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TradeChecklist, initialForm } from "./TradeChecklist";

describe("TradeChecklist", () => {
  it("shows the required trade horizon selector", () => {
    const html = renderToString(<TradeChecklist />);

    expect(html).toContain("Trade horizon *");
    expect(html).toContain("Classify this trade before planning it.");
    expect(html).toContain('<option value="intraday"');
    expect(html).toContain('<option value="swing"');
    expect(html).toContain('<option value="other"');
  });

  it("defaults new plans to intraday", () => {
    expect(initialForm.trade_horizon).toBe("intraday");
  });
});
