import type { EntryTrigger, LocationTag, MarketState, Trade, TradeThesis } from "../types";
import taxonomy from "../../../shared/price_action_taxonomy.json";

export interface BilingualTaxonomyItem<T extends string> {
  value: T; english: string; chinese: string; englishDescription?: string; chineseDescription?: string;
}

interface ContractItem {
  value: string;
  english: string;
  chinese: string;
  order: number;
  english_description?: string;
  chinese_description?: string;
}

function contractItems<T extends string>(items: ContractItem[]) {
  return [...items]
    .sort((left, right) => left.order - right.order)
    .map((item) => ({
      value: item.value as T,
      english: item.english,
      chinese: item.chinese,
      ...(item.english_description ? {
        englishDescription: item.english_description,
        chineseDescription: item.chinese_description,
      } : {}),
    })) as BilingualTaxonomyItem<T>[];
}

export const marketStateOptions = contractItems<MarketState>(taxonomy.market_state);
export const tradeThesisOptions = contractItems<TradeThesis>(taxonomy.trade_thesis);
export const entryTriggerOptions = contractItems<EntryTrigger>(taxonomy.entry_trigger);
export const locationTagOptions = contractItems<LocationTag>(taxonomy.location_tag);

export function findTaxonomyItem<T extends string>(items: BilingualTaxonomyItem<T>[], value: T | null | undefined) {
  return items.find((item) => item.value === value) ?? null;
}

const legacyState: Record<string, MarketState> = { strong_trend: "strong_trend", narrow_channel: "narrow_channel", weak_trend: "broad_channel", broad_channel: "broad_channel", trading_range: "trading_range", breakout_mode: "breakout_mode", uncertain: "unclear", opening_range: "unclear", gap_open: "unclear" };
const legacyThesis: Record<string, TradeThesis> = { breakout: "breakout", pullback: "pullback_continuation", failed_breakout: "failed_breakout", reversal: "major_reversal", left_side_bottom_pick: "major_reversal", early_reversal: "major_reversal", bottom_pick: "major_reversal", h1_h2_l1_l2: "other", wedge: "other", double_top_bottom: "other", inside_bar_triangle: "other", opening_range: "other", gap_open: "other", other: "other" };
const legacyTrigger: Record<string, EntryTrigger> = { h1_h2_l1_l2: "h1_h2_l1_l2", wedge: "wedge", double_top_bottom: "double_top_bottom", inside_bar_triangle: "inside_bar_triangle" };

export function displayClassification(trade: Pick<Trade, "market_state" | "trade_thesis" | "entry_trigger" | "location_tags" | "setup" | "market_context">) {
  const legacy = !trade.market_state || !trade.trade_thesis || !trade.entry_trigger;
  return {
    legacy,
    marketState: trade.market_state ?? legacyState[trade.market_context] ?? null,
    tradeThesis: trade.trade_thesis ?? legacyThesis[trade.setup] ?? null,
    entryTrigger: trade.entry_trigger ?? legacyTrigger[trade.setup] ?? (trade.setup ? "other" : null),
    locationTags: trade.location_tags ?? [],
  };
}

export function legacyMirrors(state: MarketState, thesis: TradeThesis) {
  const setup: Record<TradeThesis, string> = { pullback_continuation: "pullback", breakout: "breakout", breakout_pullback: "breakout", failed_breakout: "failed_breakout", range_reversal: "reversal", major_reversal: "reversal", other: "other" };
  const context: Record<MarketState, string> = { strong_trend: "strong_trend", narrow_channel: "narrow_channel", broad_channel: "broad_channel", trading_range: "trading_range", breakout_mode: "breakout_mode", unclear: "uncertain" };
  return { setup: setup[thesis], market_context: context[state] };
}
