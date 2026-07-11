import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TradeChecklist, initialForm } from "./TradeChecklist";

describe("TradeChecklist", () => {
  it("shows click-first official trade horizon choices", () => {
    const html = renderToString(<TradeChecklist />);

    expect(html).toContain("Trade horizon");
    expect(html).toContain('aria-pressed="true">Intraday');
    expect(html).toContain('aria-pressed="false">Swing');
    expect(html).toContain('aria-pressed="false">LEAP');
    expect(html).toContain('aria-pressed="false">Other');
  });

  it("defaults new plans to intraday", () => {
    expect(initialForm.trade_horizon).toBe("intraday");
  });
});
