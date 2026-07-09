import { describe, expect, it } from "vitest";

import { navigation } from "../App";
import { hashForPage, pageFromHash } from "./navigation";

describe("page navigation", () => {
  it("restores a known page from the URL hash", () => {
    expect(pageFromHash("#post-trade-review")).toBe("post-trade-review");
  });

  it("falls back to the dashboard for an unknown hash", () => {
    expect(pageFromHash("#unknown-page")).toBe("dashboard");
  });

  it("creates a stable URL hash for a page", () => {
    expect(hashForPage("rule-alerts")).toBe("#rule-alerts");
  });

  it("keeps navigation scannable without single-letter initials", () => {
    expect(navigation.every((item) => item.icon.length > 0)).toBe(true);
    expect(navigation.every((item) => item.shortLabel.length > 1)).toBe(true);
  });
});
