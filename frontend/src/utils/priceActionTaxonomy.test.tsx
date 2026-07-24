import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Trade } from "../types";
import { PriceActionClassification } from "../components/PriceActionClassification";
import { BilingualChoiceGroup, BilingualMultiSelectChips } from "../components/ui/BilingualChoiceGroup";
import { entryTriggerOptions, locationTagOptions, marketStateOptions, tradeThesisOptions } from "./priceActionTaxonomy";
import taxonomy from "../../../shared/price_action_taxonomy.json";

describe("price-action taxonomy", () => {
  it("has unique ordered values and complete bilingual labels", () => {
    for (const items of [marketStateOptions, tradeThesisOptions, entryTriggerOptions, locationTagOptions]) {
      expect(new Set(items.map((item) => item.value)).size).toBe(items.length);
      expect(items.every((item) => item.english && item.chinese)).toBe(true);
    }
    expect(marketStateOptions.find((item) => item.value === "narrow_channel")).toMatchObject({ english: "Narrow Channel", chinese: "窄通道" });
    expect(marketStateOptions.map((item) => item.value)).toEqual(["strong_trend", "narrow_channel", "broad_channel", "trading_range", "breakout_mode", "unclear"]);
  });

  it("keeps compile-time unions and rendered order aligned with the shared contract", () => {
    expect(marketStateOptions.map((item) => item.value)).toEqual(taxonomy.market_state.map((item) => item.value));
    expect(tradeThesisOptions.map((item) => item.value)).toEqual(taxonomy.trade_thesis.map((item) => item.value));
    expect(entryTriggerOptions.map((item) => item.value)).toEqual(taxonomy.entry_trigger.map((item) => item.value));
    expect(locationTagOptions.map((item) => item.value)).toEqual(taxonomy.location_tag.map((item) => item.value));
  });

  it("renders accessible single and multi-select bilingual choices", () => {
    const html = renderToString(<><BilingualChoiceGroup label="Market State" chineseLabel="市场结构" items={marketStateOptions} value="narrow_channel" onChange={() => undefined} /><BilingualMultiSelectChips label="Key Locations" chineseLabel="关键位置" items={locationTagOptions} values={["support"]} onChange={() => undefined} /></>);
    expect(html).toContain("Narrow Channel");
    expect(html).toContain("窄通道");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("✓");
  });

  it("renders full, legacy, and unclassified cockpit states", () => {
    const base = { market_state: "narrow_channel", trade_thesis: "pullback_continuation", entry_trigger: "h1_h2_l1_l2", location_tags: ["prior_day_low", "support"], setup: "pullback", market_context: "narrow_channel" } as Trade;
    const full = renderToString(<PriceActionClassification trade={base} />);
    expect(full).toContain("Price Action Classification");
    expect(full).toContain("Prior Day Low");
    expect(full).toContain("昨低");
    const legacy = renderToString(<PriceActionClassification trade={{ ...base, market_state: null, trade_thesis: null, entry_trigger: null } as unknown as Trade} compact />);
    expect(legacy).toContain("Legacy classification / 历史分类");
    const missing = renderToString(<PriceActionClassification trade={{ ...base, market_state: null, trade_thesis: null, entry_trigger: null, setup: "", market_context: "" } as unknown as Trade} />);
    expect(missing).toContain("Not classified");
    expect(missing).toContain("未分类");
  });

  it("can render created-trade classifications in English only", () => {
    const base = { market_state: "narrow_channel", trade_thesis: "pullback_continuation", entry_trigger: "h1_h2_l1_l2", location_tags: ["prior_day_low"], setup: "pullback", market_context: "narrow_channel" } as Trade;
    const full = renderToString(<PriceActionClassification trade={base} englishOnly />);
    expect(full).toContain("Price Action Classification");
    expect(full).toContain("Narrow Channel");
    expect(full).toContain("Prior Day Low");
    expect(full).not.toContain("价格行为分类");
    expect(full).not.toContain("窄通道");
    expect(full).not.toContain("昨低");

    const compact = renderToString(<PriceActionClassification trade={{ ...base, market_state: null, trade_thesis: null, entry_trigger: null } as unknown as Trade} compact englishOnly />);
    expect(compact).toContain("Legacy classification");
    expect(compact).not.toContain("历史分类");
  });
});
