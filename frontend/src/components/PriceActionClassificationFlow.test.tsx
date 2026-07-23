import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EntryTrigger, LocationTag, MarketState, TradeThesis } from "../types";
import {
  AUTO_ADVANCE_MS,
  cancelClassificationTimer,
  firstIncompleteClassificationStage,
  isRepeatedSelection,
  PriceActionClassificationFlow,
  replaceAutoAdvanceTimer,
} from "./PriceActionClassificationFlow";

const noop = () => undefined;

function renderFlow(values: {
  marketState?: MarketState | "";
  tradeThesis?: TradeThesis | "";
  entryTrigger?: EntryTrigger | "";
  locationTags?: LocationTag[];
} = {}) {
  return renderToString(<PriceActionClassificationFlow
    marketState={values.marketState ?? ""}
    tradeThesis={values.tradeThesis ?? ""}
    entryTrigger={values.entryTrigger ?? ""}
    locationTags={values.locationTags ?? []}
    onMarketStateChange={noop}
    onTradeThesisChange={noop}
    onEntryTriggerChange={noop}
    onLocationTagsChange={noop}
    onBackToInstrument={noop}
    onContinue={noop}
    canContinue
  />);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PriceActionClassificationFlow", () => {
  it("shows only Market State initially with bilingual accessible choices", () => {
    const html = renderFlow();
    expect(html).toContain("What market structure are you trading?");
    expect(html).toContain("你正在交易什么市场结构？");
    expect(html).toContain("Narrow Channel");
    expect(html).toContain("窄通道");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("What is the core idea of this trade?");
    expect(html).not.toContain("What specifically triggers the entry?");
    expect(html).not.toContain("Where is this setup occurring?");
  });

  it("restores the first incomplete stage without discarding prior selections", () => {
    expect(firstIncompleteClassificationStage({ marketState: "narrow_channel", tradeThesis: "", entryTrigger: "", locationTags: [] })).toBe("trade_thesis");
    expect(firstIncompleteClassificationStage({ marketState: "narrow_channel", tradeThesis: "range_reversal", entryTrigger: "", locationTags: [] })).toBe("entry_trigger");
    expect(firstIncompleteClassificationStage({ marketState: "narrow_channel", tradeThesis: "range_reversal", entryTrigger: "second_entry", locationTags: ["range_high"] })).toBe("location_tags");

    const html = renderFlow({ marketState: "narrow_channel", tradeThesis: "range_reversal" });
    expect(html).toContain("What specifically triggers the entry?");
    expect(html).toContain("Narrow Channel");
    expect(html).toContain("Range Reversal");
    expect(html).not.toContain("What market structure are you trading?");
  });

  it("requires the same single-select choice twice before confirmation", () => {
    expect(isRepeatedSelection(null, "market_state", "narrow_channel")).toBe(false);
    expect(isRepeatedSelection({ stage: "market_state", value: "narrow_channel" }, "market_state", "narrow_channel")).toBe(true);
    expect(isRepeatedSelection({ stage: "market_state", value: "strong_trend" }, "market_state", "narrow_channel")).toBe(false);
    expect(isRepeatedSelection({ stage: "trade_thesis", value: "range_reversal" }, "market_state", "range_reversal")).toBe(false);

    const html = renderFlow();
    expect(html).toContain("Select once to review, then select the same choice again to continue.");
    expect(html).toContain("第二次点击同一选项后继续");
  });

  it("renders optional multi-select locations and an explicit no-location choice", () => {
    const html = renderFlow({ marketState: "narrow_channel", tradeThesis: "range_reversal", entryTrigger: "second_entry", locationTags: ["range_high", "resistance"] });
    expect(html).toContain("Where is this setup occurring?");
    expect(html).toContain("Select every relevant location");
    expect(html).toContain("选择所有相关的关键位置");
    expect(html).toContain("No key location");
    expect(html).toContain("无特别关键位置");
    expect(html).toContain("2 locations selected");
    expect(html).toContain("已选择 2 个关键位置");
    expect(html).toContain("Continue to Risk &amp; Discipline");
  });

  it("replaces duplicate auto-advance timers and supports cleanup", () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    let timer = replaceAutoAdvanceTimer(null, first);
    timer = replaceAutoAdvanceTimer(timer, second);

    vi.advanceTimersByTime(AUTO_ADVANCE_MS - 1);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();

    const cancelled = vi.fn();
    timer = replaceAutoAdvanceTimer(null, cancelled);
    cancelClassificationTimer(timer);
    vi.advanceTimersByTime(AUTO_ADVANCE_MS);
    expect(cancelled).not.toHaveBeenCalled();
  });
});
