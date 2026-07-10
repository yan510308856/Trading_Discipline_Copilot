import type { Market, Trade } from "../types";

export const marketGroups = [
  { key: "stocks", label: "Stocks" },
  { key: "options", label: "Options" },
  { key: "futures", label: "Futures" },
  { key: "other", label: "Other" },
] as const;

export type MarketGroupKey = (typeof marketGroups)[number]["key"];

export function marketGroupFor(market: Market): MarketGroupKey {
  if (market === "stocks" || market === "options" || market === "futures") {
    return market;
  }
  return "other";
}

export function groupTradesByMarket<T extends Pick<Trade, "market">>(
  trades: T[],
): Array<{ key: MarketGroupKey; label: string; trades: T[] }> {
  return marketGroups
    .map((group) => ({
      ...group,
      trades: trades.filter((trade) => marketGroupFor(trade.market) === group.key),
    }))
    .filter((group) => group.trades.length > 0);
}
