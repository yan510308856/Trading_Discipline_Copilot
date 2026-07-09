import type { DailyReadinessStatus } from "../types";

export const readinessStatusLabel: Record<DailyReadinessStatus, string> = {
  not_cleared: "Not cleared",
  partially_ready: "Partially ready",
  cleared: "Cleared",
};

export const readinessStatusMessage: Record<DailyReadinessStatus, string> = {
  not_cleared:
    "Intraday trading is not cleared yet. Finish the required preparation checklist first.",
  partially_ready: "Some required preparation items are still incomplete.",
  cleared:
    "You are cleared to plan intraday trades today. Continue to follow pre-trade rules.",
};

export function readinessProgressText(complete: number, total: number): string {
  return `${complete} / ${total} required items complete.`;
}
