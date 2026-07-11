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
