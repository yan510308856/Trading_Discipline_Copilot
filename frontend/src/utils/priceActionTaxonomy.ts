import type { EntryTrigger, LocationTag, MarketState, Trade, TradeThesis } from "../types";

export interface BilingualTaxonomyItem<T extends string> {
  value: T; english: string; chinese: string; englishDescription?: string; chineseDescription?: string;
}

export const marketStateOptions: BilingualTaxonomyItem<MarketState>[] = [
  ["strong_trend", "Strong Trend", "强趋势"], ["narrow_channel", "Narrow Channel", "窄通道"],
  ["broad_channel", "Broad Channel", "宽通道"], ["trading_range", "Trading Range", "震荡区间"],
  ["breakout_mode", "Breakout Mode", "突破模式"], ["unclear", "Unclear", "结构不清"],
].map(([value, english, chinese]) => ({ value: value as MarketState, english, chinese }));

export const tradeThesisOptions: BilingualTaxonomyItem<TradeThesis>[] = [
  { value: "pullback_continuation", english: "Pullback Continuation", chinese: "回调延续", englishDescription: "Trade with the existing trend after a retracement.", chineseDescription: "顺着已有趋势，在回调后等待趋势继续。" },
  { value: "breakout", english: "Breakout", chinese: "突破", englishDescription: "Trade confirmed expansion beyond a meaningful boundary.", chineseDescription: "交易价格有效突破重要边界后的扩张。" },
  { value: "breakout_pullback", english: "Breakout Pullback", chinese: "突破回踩" },
  { value: "failed_breakout", english: "Failed Breakout", chinese: "突破失败" },
  { value: "range_reversal", english: "Range Reversal", chinese: "区间边缘反转" },
  { value: "major_reversal", english: "Major Trend Reversal", chinese: "主要趋势反转" },
  { value: "other", english: "Other", chinese: "其他逻辑" },
];

export const entryTriggerOptions: BilingualTaxonomyItem<EntryTrigger>[] = [
  ["h1_h2_l1_l2", "H1 / H2 / L1 / L2", "高一 / 高二 / 低一 / 低二"], ["second_entry", "Second Entry", "二次入场"],
  ["wedge", "Wedge", "楔形"], ["double_top_bottom", "Double Top / Bottom", "双顶 / 双底"],
  ["inside_bar_triangle", "Inside Bar / Triangle", "内包线 / 三角形"], ["strong_signal_bar", "Strong Signal Bar", "强信号K线"],
  ["breakout_retest", "Breakout Retest", "突破回测"], ["other", "Other", "其他触发"],
].map(([value, english, chinese]) => ({ value: value as EntryTrigger, english, chinese }));

export const locationTagOptions: BilingualTaxonomyItem<LocationTag>[] = [
  ["opening_range", "Opening Range", "开盘区间"], ["gap_open", "Gap Open", "跳空开盘"],
  ["range_high", "Range High", "区间上沿"], ["range_low", "Range Low", "区间下沿"],
  ["prior_day_high", "Prior Day High", "昨高"], ["prior_day_low", "Prior Day Low", "昨低"],
  ["support", "Support", "支撑"], ["resistance", "Resistance", "阻力"],
  ["pullback_zone", "Pullback Zone", "回调区域"], ["breakout_point", "Breakout Point", "突破位"],
].map(([value, english, chinese]) => ({ value: value as LocationTag, english, chinese }));

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
