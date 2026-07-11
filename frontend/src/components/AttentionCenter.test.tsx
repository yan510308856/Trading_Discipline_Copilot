import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppQueryProvider } from "../queryClient";
import { AttentionCenter } from "./AttentionCenter";

describe("AttentionCenter", () => {
  it("renders the normalized operational page and filters", () => {
    const html = renderToString(<AppQueryProvider><AttentionCenter /></AppQueryProvider>);
    expect(html).toContain("Attention Center");
    expect(html).toContain("Severity");
    expect(html).toContain("Blockers");
    expect(html).toContain("Trade horizon");
  });
});
