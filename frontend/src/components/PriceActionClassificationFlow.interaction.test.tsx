// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EntryTrigger, LocationDecision, LocationTag, MarketState, TradeThesis } from "../types";
import { AUTO_ADVANCE_MS, PriceActionClassificationFlow } from "./PriceActionClassificationFlow";

function Harness() {
  const [marketState, setMarketState] = useState<MarketState | "">("");
  const [tradeThesis, setTradeThesis] = useState<TradeThesis | "">("");
  const [entryTrigger, setEntryTrigger] = useState<EntryTrigger | "">("");
  const [locationTags, setLocationTags] = useState<LocationTag[]>([]);
  const [locationDecision, setLocationDecision] = useState<LocationDecision | null>(null);
  return <PriceActionClassificationFlow
    marketState={marketState}
    tradeThesis={tradeThesis}
    entryTrigger={entryTrigger}
    locationTags={locationTags}
    locationDecision={locationDecision}
    onMarketStateChange={setMarketState}
    onTradeThesisChange={setTradeThesis}
    onEntryTriggerChange={setEntryTrigger}
    onLocationTagsChange={(values) => {
      setLocationTags(values);
      setLocationDecision(values.length ? "selected" : null);
    }}
    onNoLocation={() => {
      setLocationTags([]);
      setLocationDecision("none");
    }}
    onBackToInstrument={() => undefined}
    onContinue={() => undefined}
    canContinue={locationDecision !== null}
  />;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function choice(name: RegExp) {
  return screen.getAllByRole("button", { name }).find((button) => button.hasAttribute("aria-pressed"))!;
}

describe("PriceActionClassificationFlow interactions", () => {
  it("arms on the first click and advances only after the second click plus 350ms", async () => {
    render(<Harness />);
    const narrow = choice(/Narrow Channel/);

    fireEvent.click(narrow);
    expect(narrow.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/Selected — click the same choice again/)).toBeTruthy();
    expect(screen.queryByText("What is the core idea of this trade?")).toBeNull();

    fireEvent.click(narrow);
    act(() => vi.advanceTimersByTime(AUTO_ADVANCE_MS - 1));
    expect(screen.queryByText("What is the core idea of this trade?")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("What is the core idea of this trade?")).toBeTruthy();
  });

  it("replaces an armed choice, preserves Back selections, and keeps locations undecided", async () => {
    render(<Harness />);
    fireEvent.click(choice(/Narrow Channel/));
    fireEvent.click(choice(/Strong Trend/));
    expect(choice(/Narrow Channel/).getAttribute("aria-pressed")).toBe("false");
    expect(choice(/Strong Trend/).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(choice(/Strong Trend/));
    act(() => vi.advanceTimersByTime(AUTO_ADVANCE_MS));
    fireEvent.click(screen.getByRole("button", { name: /Market State: completed/ }));
    expect(choice(/Strong Trend/).getAttribute("aria-pressed")).toBe("true");
  });

  it("does not infer No key location and returns to undecided after removing the last tag", async () => {
    render(<Harness />);
    for (const name of [/Narrow Channel/, /Pullback Continuation/, /Second Entry/]) {
      fireEvent.click(choice(name));
      fireEvent.click(choice(name));
      act(() => vi.advanceTimersByTime(AUTO_ADVANCE_MS));
    }
    const noLocation = screen.getByRole("button", { name: /No key location/ });
    expect(noLocation.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Location decision required")).toBeTruthy();
    const support = screen.getByRole("button", { name: /Support/ });
    fireEvent.click(support);
    expect(support.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(support);
    expect(screen.getByText("Location decision required")).toBeTruthy();
    fireEvent.click(noLocation);
    expect(noLocation.getAttribute("aria-pressed")).toBe("true");
  });
});
