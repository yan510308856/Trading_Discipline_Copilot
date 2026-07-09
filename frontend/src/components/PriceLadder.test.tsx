import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PriceLadder } from "./PriceLadder";

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
});
