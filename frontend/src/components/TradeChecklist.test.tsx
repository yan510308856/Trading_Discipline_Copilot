import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TradeChecklist, initialForm } from "./TradeChecklist";
import { AppQueryProvider } from "../queryClient";

function renderChecklist() {
  return renderToString(<AppQueryProvider><TradeChecklist /></AppQueryProvider>);
}

describe("TradeChecklist", () => {
  it("shows click-first official trade horizon choices", () => {
    const html = renderChecklist();

    expect(html).toContain("Trade horizon");
    expect(html).toContain('aria-pressed="true">Intraday');
    expect(html).toContain('aria-pressed="false">Swing');
    expect(html).toContain('aria-pressed="false">LEAP');
    expect(html).toContain('aria-pressed="false">Other');
  });

  it("defaults new plans to intraday", () => {
    expect(initialForm.trade_horizon).toBe("intraday");
  });

  it("explains disabled creation prerequisites and position-size risk", () => {
    const html = renderChecklist();
    expect(html).toContain("Enter a symbol.");
    expect(initialForm.position_size).toBe("");
  });
});
