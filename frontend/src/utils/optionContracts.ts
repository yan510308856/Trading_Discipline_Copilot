import type { TradeHorizon } from "../types";

function iso(date: Date): string { return date.toISOString().slice(0, 10); }

export function upcomingOptionExpirations(horizon: TradeHorizon, now = new Date()): string[] {
  if (horizon === "leap") {
    return [1, 2, 3].map((years) => {
      const january = new Date(Date.UTC(now.getUTCFullYear() + years, 0, 1));
      const firstFriday = 1 + ((5 - january.getUTCDay() + 7) % 7);
      return iso(new Date(Date.UTC(january.getUTCFullYear(), 0, firstFriday + 14)));
    });
  }
  const result: string[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (result.length < 8) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() === 5) result.push(iso(cursor));
  }
  return result;
}

export function defaultStrikeIncrement(price: number): number {
  if (price < 25) return 0.5;
  if (price < 100) return 1;
  if (price < 250) return 2.5;
  if (price < 500) return 5;
  return 10;
}

export function strikeSuggestions(price: number, increment: number): number[] {
  const atm = Math.round(price / increment) * increment;
  return [-3, -2, -1, 0, 1, 2, 3].map((offset) => Number((atm + offset * increment).toFixed(2))).filter((strike) => strike > 0);
}

export function optionContractSummary(symbol: string, expiration: string, strike: number, type: "call" | "put"): string {
  return `${symbol.trim().toUpperCase()} ${expiration} ${strike.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}${type === "call" ? "C" : "P"}`;
}
