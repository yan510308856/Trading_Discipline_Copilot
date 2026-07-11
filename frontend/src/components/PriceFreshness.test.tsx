import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PriceFreshness } from "./PriceFreshness";

describe("PriceFreshness", () => {
  const now = new Date("2026-07-11T14:32:00Z");

  it("renders automatic source and current freshness", () => {
    expect(renderToString(<PriceFreshness source="finnhub" updatedAt="2026-07-11T14:31:42Z" now={now} />)).toContain("Finnhub · updated 18 seconds ago");
  });

  it("renders stale automatic prices", () => {
    const html = renderToString(<PriceFreshness source="finnhub" updatedAt="2026-07-11T14:26:00Z" now={now} />);
    expect(html).toContain("Stale · updated 6 minutes ago");
    expect(html).toContain("stale");
  });

  it("renders manual and unavailable states", () => {
    expect(renderToString(<PriceFreshness source="manual" updatedAt="2026-07-11T14:32:00Z" now={now} />)).toContain("Manual · updated at");
    expect(renderToString(<PriceFreshness source={null} updatedAt={null} now={now} />)).toContain("No price recorded");
  });
});
