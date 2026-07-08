import type { PageId } from "../types";

const pageIds: PageId[] = [
  "dashboard",
  "trade-checklist",
  "rule-alerts",
  "open-trades",
  "post-trade-review",
  "daily-summary",
  "rules-library",
];

export function pageFromHash(hash: string): PageId {
  const candidate = hash.replace(/^#/, "");
  return pageIds.includes(candidate as PageId) ? (candidate as PageId) : "dashboard";
}

export function hashForPage(page: PageId): string {
  return `#${page}`;
}
