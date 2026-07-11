import { describe, expect, it } from "vitest";

import { navigation } from "../App";
import { contextFromHash, hashForPage, hashWithContext, pageFromHash, positiveIntegerContext } from "./navigation";

describe("page navigation", () => {
  it("restores a known page from the URL hash", () => {
    expect(pageFromHash("#post-trade-review")).toBe("post-trade-review");
  });

  it("falls back to the dashboard for an unknown hash", () => {
    expect(pageFromHash("#unknown-page")).toBe("dashboard");
  });

  it("creates a stable URL hash for a page", () => {
    expect(hashForPage("attention")).toBe("#attention");
    expect(pageFromHash("#rule-alerts")).toBe("attention");
  });

  it("keeps navigation scannable without single-letter initials", () => {
    expect(navigation.every((item) => item.icon.length > 0)).toBe(true);
    expect(navigation.every((item) => item.shortLabel.length > 1)).toBe(true);
  });

  it("preserves deep-link context across reload parsing", () => {
    const hash = hashWithContext("open-trades", { trade_id: 123, section: "price-alerts" });
    expect(pageFromHash(hash)).toBe("open-trades");
    expect(contextFromHash(hash).get("trade_id")).toBe("123");
    expect(contextFromHash(hash).get("section")).toBe("price-alerts");
  });

  it("renames Rule Alerts to Attention", () => {
    expect(navigation.find((item) => item.id === "attention")?.label).toBe("Attention");
    expect(navigation.some((item) => item.label === "Rule Alerts")).toBe(false);
  });

  it("parses only explicitly provided positive integer trade IDs", () => {
    expect(positiveIntegerContext(contextFromHash("#open-trades"), "trade_id")).toBeNull();
    expect(positiveIntegerContext(contextFromHash("#open-trades?trade_id=abc"), "trade_id")).toBeNull();
    expect(positiveIntegerContext(contextFromHash("#open-trades?trade_id=0"), "trade_id")).toBeNull();
    expect(positiveIntegerContext(contextFromHash("#open-trades?trade_id=-2"), "trade_id")).toBeNull();
    expect(positiveIntegerContext(contextFromHash("#open-trades?trade_id=123"), "trade_id")).toBe(123);
  });
});
