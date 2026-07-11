import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppQueryProvider } from "../queryClient";
import { Dashboard } from "./Dashboard";

describe("Dashboard", () => {
  it("renders the summary loading state inside the query provider", () => {
    const html = renderToString(
      <AppQueryProvider>
        <Dashboard />
      </AppQueryProvider>,
    );

    expect(html).toContain("Today at a glance");
    expect(html).toContain("Loading today");
    expect(html).toContain("Operational health");
    expect(html).not.toContain("Today&#x27;s Required Actions");
    expect(html).toContain("Price alerts are not fully active");
    expect(html.lastIndexOf("Intraday Readiness")).toBeGreaterThan(html.indexOf("Operational health"));
  });
});
