import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { HorizonFilter, horizonForApi } from "./HorizonFilter";

describe("HorizonFilter", () => {
  it("renders all horizon options", () => {
    const html = renderToString(
      <HorizonFilter value="all" onChange={vi.fn()} />,
    );

    expect(html).toContain("Trade horizon");
    expect(html).toContain('<option value="all"');
    expect(html).toContain('<option value="intraday"');
    expect(html).toContain('<option value="swing"');
    expect(html).toContain('<option value="other"');
  });

  it("maps all to no API filter", () => {
    expect(horizonForApi("all")).toBeUndefined();
    expect(horizonForApi("intraday")).toBe("intraday");
  });
});
