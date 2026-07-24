import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PriceLadder, spreadLabelPositions } from "./PriceLadder";

describe("PriceLadder", () => {
  it("renders recorded partial exits on the price map", () => {
    const html = renderToString(
      <PriceLadder
        entry={742}
        currentPrice={744}
        currentStop={739}
        target1={750}
        target2={760}
        partialExits={[{ price: 748, quantity: 1 }]}
      />,
    );

    expect(html).toContain("Partial 1 (1)");
    expect(html).toContain("price-partial");
    expect(html).toContain("748");
  });

  it("renders the supplied active stop level", () => {
    const html = renderToString(
      <PriceLadder
        entry={742}
        currentPrice={744}
        currentStop={745}
        target1={750}
        target2={755}
      />,
    );

    expect(html).toContain("Stop");
    expect(html).toContain("745");
  });

  it("replaces the initial-entry marker with weighted average after an add", () => {
    const html = renderToString(
      <PriceLadder
        entry={100}
        currentPrice={112}
        currentStop={100}
        target1={115}
        target2={null}
        weightedAverageEntry={103.33}
        entryExecutions={[
          { id: 1, trade_id: 1, executed_at: "2026-07-24T10:00:00Z", entry_kind: "initial", underlying_price: 100, quantity: 2, stop_at_entry: 95, option_price: null, reason: "initial_plan", notes: null, created_at: "2026-07-24T10:00:00Z" },
          { id: 2, trade_id: 1, executed_at: "2026-07-24T11:00:00Z", entry_kind: "add", underlying_price: 110, quantity: 1, stop_at_entry: 100, option_price: null, reason: "breakout_confirmation", notes: null, created_at: "2026-07-24T11:00:00Z" },
        ]}
      />,
    );

    expect(html).not.toContain("Initial entry");
    expect(html).toContain("Add 1 (1)");
    expect(html).toContain("Weighted average");
  });

  it("shows only the initial-entry marker before any additions", () => {
    const html = renderToString(
      <PriceLadder
        entry={100}
        currentPrice={105}
        currentStop={95}
        target1={115}
        target2={null}
        weightedAverageEntry={100}
        entryExecutions={[
          { id: 1, trade_id: 1, executed_at: "2026-07-24T10:00:00Z", entry_kind: "initial", underlying_price: 100, quantity: 2, stop_at_entry: 95, option_price: null, reason: "initial_plan", notes: null, created_at: "2026-07-24T10:00:00Z" },
        ]}
      />,
    );

    expect(html).toContain("Initial entry");
    expect(html).not.toContain("Weighted average");
  });

  it("automatically separates left labels for nearby prices", () => {
    const positions = spreadLabelPositions([120, 121, 122]);
    const sorted = [...positions].sort((left, right) => left - right);

    expect(sorted[1] - sorted[0]).toBeGreaterThanOrEqual(20);
    expect(sorted[2] - sorted[1]).toBeGreaterThanOrEqual(20);
  });

  it("applies the same collision offset to labels and right-side prices", () => {
    const html = renderToString(
      <PriceLadder entry={245.3} currentPrice={245.34} currentStop={237.68} target1={257.25} target2={null} />,
    );

    expect(html.match(/transform:translateY\([^)]*px\)/g)).toHaveLength(8);
  });
});
