import type { PageId } from "../types";

const pageIds: PageId[] = [
  "dashboard",
  "trade-checklist",
  "attention",
  "open-trades",
  "post-trade-review",
  "daily-summary",
  "rules-library",
];

export function pageFromHash(hash: string): PageId {
  const candidate = hash.replace(/^#/, "").split("?")[0];
  if (candidate === "rule-alerts") return "attention";
  return pageIds.includes(candidate as PageId) ? (candidate as PageId) : "dashboard";
}

export function hashForPage(page: PageId): string {
  return `#${page}`;
}

export function hashWithContext(page: PageId, context: Record<string, string | number> = {}): string {
  const query = new URLSearchParams(Object.entries(context).map(([key, value]) => [key, String(value)])).toString();
  return `${hashForPage(page)}${query ? `?${query}` : ""}`;
}

export function contextFromHash(hash: string): URLSearchParams {
  const query = hash.split("?")[1] ?? "";
  return new URLSearchParams(query);
}
