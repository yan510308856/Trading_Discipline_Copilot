import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppQueryProvider, createAppQueryClient } from "./queryClient";

describe("AppQueryProvider", () => {
  it("renders children inside a query provider", () => {
    const html = renderToString(
      <AppQueryProvider>
        <span>Query ready</span>
      </AppQueryProvider>,
    );

    expect(html).toContain("Query ready");
  });

  it("creates an isolated query client for tests", () => {
    expect(createAppQueryClient()).not.toBe(createAppQueryClient());
  });
});
