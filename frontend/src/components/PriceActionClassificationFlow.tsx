import { useEffect, useRef, useState, type ReactNode } from "react";

import type { EntryTrigger, LocationDecision, LocationTag, MarketState, TradeThesis } from "../types";
import {
  entryTriggerOptions,
  findTaxonomyItem,
  locationTagOptions,
  marketStateOptions,
  tradeThesisOptions,
} from "../utils/priceActionTaxonomy";
import { BilingualChoiceGroup, BilingualMultiSelectChips } from "./ui/BilingualChoiceGroup";

export type ClassificationStage = "market_state" | "trade_thesis" | "entry_trigger" | "location_tags";

interface ClassificationValues {
  marketState: MarketState | "";
  tradeThesis: TradeThesis | "";
  entryTrigger: EntryTrigger | "";
  locationTags: LocationTag[];
  locationDecision?: LocationDecision | null;
}

interface ArmedSelection {
  stage: Exclude<ClassificationStage, "location_tags">;
  value: string;
}

interface PriceActionClassificationFlowProps extends ClassificationValues {
  onMarketStateChange: (value: MarketState) => void;
  onTradeThesisChange: (value: TradeThesis) => void;
  onEntryTriggerChange: (value: EntryTrigger) => void;
  onLocationTagsChange: (values: LocationTag[]) => void;
  onNoLocation: () => void;
  onBackToInstrument: () => void;
  onContinue: () => void;
  canContinue: boolean;
  continueDisabledReason?: string;
  tradeThesisExtra?: ReactNode;
}

export const AUTO_ADVANCE_MS = 350;
const TRANSITION_OUT_MS = 110;

export const classificationStages = [
  { id: "market_state", number: "01", english: "Market State", chinese: "市场结构" },
  { id: "trade_thesis", number: "02", english: "Trade Thesis", chinese: "交易逻辑" },
  { id: "entry_trigger", number: "03", english: "Entry Trigger", chinese: "入场触发" },
  { id: "location_tags", number: "04", english: "Key Locations", chinese: "关键位置" },
] as const;

export function firstIncompleteClassificationStage(values: ClassificationValues): ClassificationStage {
  if (!values.marketState) return "market_state";
  if (!values.tradeThesis) return "trade_thesis";
  if (!values.entryTrigger) return "entry_trigger";
  return "location_tags";
}

export function replaceAutoAdvanceTimer(existingTimer: number | null, callback: () => void) {
  if (existingTimer !== null) globalThis.clearTimeout(existingTimer);
  return globalThis.setTimeout(callback, AUTO_ADVANCE_MS);
}

export function cancelClassificationTimer(timer: number | null) {
  if (timer !== null) globalThis.clearTimeout(timer);
}

export function isRepeatedSelection(armedSelection: ArmedSelection | null, stage: ArmedSelection["stage"], value: string) {
  return armedSelection?.stage === stage && armedSelection.value === value;
}

function stageIndex(stage: ClassificationStage) {
  return classificationStages.findIndex((item) => item.id === stage);
}

export function PriceActionClassificationFlow({
  marketState,
  tradeThesis,
  entryTrigger,
  locationTags,
  locationDecision,
  onMarketStateChange,
  onTradeThesisChange,
  onEntryTriggerChange,
  onLocationTagsChange,
  onNoLocation,
  onBackToInstrument,
  onContinue,
  canContinue,
  continueDisabledReason,
  tradeThesisExtra,
}: PriceActionClassificationFlowProps) {
  const [stage, setStage] = useState<ClassificationStage>(() => firstIncompleteClassificationStage({ marketState, tradeThesis, entryTrigger, locationTags, locationDecision }));
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isLeaving, setIsLeaving] = useState(false);
  const [confirmingStage, setConfirmingStage] = useState<ClassificationStage | null>(null);
  const [armedSelection, setArmedSelection] = useState<ArmedSelection | null>(null);
  const autoAdvanceTimer = useRef<number | null>(null);
  const transitionTimer = useRef<number | null>(null);

  function clearAutoAdvance() {
    cancelClassificationTimer(autoAdvanceTimer.current);
    autoAdvanceTimer.current = null;
  }

  function clearTransition() {
    if (transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
  }

  useEffect(() => () => {
    clearAutoAdvance();
    clearTransition();
  }, []);

  function navigateTo(nextStage: ClassificationStage, nextDirection: "forward" | "backward") {
    if (nextStage === stage) return;
    clearAutoAdvance();
    clearTransition();
    setConfirmingStage(null);
    setArmedSelection(null);
    setDirection(nextDirection);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion) {
      setStage(nextStage);
      setIsLeaving(false);
      return;
    }
    setIsLeaving(true);
    transitionTimer.current = window.setTimeout(() => {
      setStage(nextStage);
      setIsLeaving(false);
      transitionTimer.current = null;
    }, TRANSITION_OUT_MS);
  }

  function scheduleAutoAdvance(currentStage: ClassificationStage, nextStage: ClassificationStage) {
    setConfirmingStage(currentStage);
    autoAdvanceTimer.current = replaceAutoAdvanceTimer(autoAdvanceTimer.current, () => {
      autoAdvanceTimer.current = null;
      navigateTo(nextStage, "forward");
    });
  }

  function selectMarketState(value: MarketState) {
    clearAutoAdvance();
    setConfirmingStage(null);
    if (!isRepeatedSelection(armedSelection, "market_state", value)) {
      onMarketStateChange(value);
      setArmedSelection({ stage: "market_state", value });
      return;
    }
    setArmedSelection(null);
    scheduleAutoAdvance("market_state", "trade_thesis");
  }

  function selectTradeThesis(value: TradeThesis) {
    clearAutoAdvance();
    setConfirmingStage(null);
    if (!isRepeatedSelection(armedSelection, "trade_thesis", value)) {
      onTradeThesisChange(value);
      setArmedSelection({ stage: "trade_thesis", value });
      return;
    }
    setArmedSelection(null);
    scheduleAutoAdvance("trade_thesis", "entry_trigger");
  }

  function selectEntryTrigger(value: EntryTrigger) {
    clearAutoAdvance();
    setConfirmingStage(null);
    if (!isRepeatedSelection(armedSelection, "entry_trigger", value)) {
      onEntryTriggerChange(value);
      setArmedSelection({ stage: "entry_trigger", value });
      return;
    }
    setArmedSelection(null);
    scheduleAutoAdvance("entry_trigger", "location_tags");
  }

  const currentIndex = stageIndex(stage);
  const summary = [
    { stage: "market_state" as const, item: findTaxonomyItem(marketStateOptions, marketState || null) },
    { stage: "trade_thesis" as const, item: findTaxonomyItem(tradeThesisOptions, tradeThesis || null) },
    { stage: "entry_trigger" as const, item: findTaxonomyItem(entryTriggerOptions, entryTrigger || null) },
  ].filter((selection) => selection.item !== null);
  const selectionHint = <p className={`selection-confirmation-hint${armedSelection?.stage === stage ? " ready" : ""}`} aria-live="polite">
    <strong>{armedSelection?.stage === stage ? "Selected — click the same choice again to continue." : "Select once to review, then select the same choice again to continue."}</strong>
    <span lang="zh">{armedSelection?.stage === stage ? "已选择 — 再次点击同一选项以继续。" : "第一次点击选择并确认，第二次点击同一选项后继续。"}</span>
  </p>;

  return <section className={`classification-flow direction-${direction}${confirmingStage === stage ? " is-confirming" : ""}`}>
    <div className="classification-flow-heading">
      <div><p className="eyebrow">Price Action Classification</p><h3 lang="zh">价格行为分类</h3></div>
      <span>Sequential plan check · 01—04</span>
    </div>

    <nav className="classification-progress" aria-label="Price action classification progress">
      {classificationStages.map((item, index) => {
        const current = item.id === stage;
        const completed = index < currentIndex;
        const upcoming = index > currentIndex;
        return <button
          type="button"
          key={item.id}
          className={current ? "current" : completed ? "completed" : "upcoming"}
          aria-current={current ? "step" : undefined}
          aria-label={`${item.english}: ${current ? "current step" : completed ? "completed" : "upcoming"}`}
          disabled={upcoming}
          onClick={() => completed && navigateTo(item.id, "backward")}
        >
          <span className="classification-step-number" aria-hidden="true">{completed ? "✓" : item.number}</span>
          <span><strong>{item.english}</strong><small lang="zh">{item.chinese}</small></span>
        </button>;
      })}
    </nav>

    {summary.length > 0 && <div className="classification-summary" aria-label="Selected classifications">
      {summary.map((selection) => {
        const item = selection.item!;
        const index = stageIndex(selection.stage);
        return <button type="button" key={selection.stage} disabled={index > currentIndex} onClick={() => index < currentIndex && navigateTo(selection.stage, "backward")}>
          <strong>{item.english}</strong><small lang="zh">{item.chinese}</small>
        </button>;
      })}
      {locationTags.map((value) => {
        const item = findTaxonomyItem(locationTagOptions, value);
        return item && <span key={value}><strong>{item.english}</strong><small lang="zh">{item.chinese}</small></span>;
      })}
    </div>}

    <div key={stage} className={`classification-stage-panel ${isLeaving ? "is-leaving" : "is-entering"}`}>
      {stage === "market_state" && <>
        <header><span>01 / 04</span><h4>What market structure are you trading?</h4><p lang="zh">你正在交易什么市场结构？</p><small>Classify the environment before defining the trade idea.</small></header>
        <BilingualChoiceGroup label="Market State" chineseLabel="市场结构" items={marketStateOptions} value={marketState || null} onChange={selectMarketState} legendHidden confirming={confirmingStage === stage} />
        {selectionHint}
      </>}

      {stage === "trade_thesis" && <>
        <header><span>02 / 04</span><h4>What is the core idea of this trade?</h4><p lang="zh">这笔交易的核心逻辑是什么？</p><small>Choose the thesis that best explains why the setup should work.</small></header>
        <BilingualChoiceGroup label="Trade Thesis" chineseLabel="交易逻辑" items={tradeThesisOptions} value={tradeThesis || null} onChange={selectTradeThesis} emphasis="strong" legendHidden confirming={confirmingStage === stage} />
        {selectionHint}
        {tradeThesisExtra}
      </>}

      {stage === "entry_trigger" && <>
        <header><span>03 / 04</span><h4>What specifically triggers the entry?</h4><p lang="zh">什么信号触发你现在入场？</p><small>Name the observable signal that converts the thesis into an entry.</small></header>
        <BilingualChoiceGroup label="Entry Trigger" chineseLabel="入场触发" items={entryTriggerOptions} value={entryTrigger || null} onChange={selectEntryTrigger} emphasis="compact" legendHidden confirming={confirmingStage === stage} />
        {selectionHint}
      </>}

      {stage === "location_tags" && <>
        <header><span>04 / 04</span><h4>Where is this setup occurring?</h4><p lang="zh">这个交易发生在什么关键位置？</p><small>Select every relevant location · 选择所有相关的关键位置</small><em>Optional · Multiple selections allowed<br /><span lang="zh">可选 · 可以多选</span></em></header>
        <BilingualMultiSelectChips label="Key Locations" chineseLabel="关键位置" items={locationTagOptions} values={locationTags} onChange={onLocationTagsChange} legendHidden />
        <button type="button" className="no-location-button" aria-pressed={locationDecision === "none"} onClick={onNoLocation}><span aria-hidden="true">{locationDecision === "none" ? "✓" : "○"}</span><strong>No key location</strong><small lang="zh">无特别关键位置</small></button>
        <p className="location-count" aria-live="polite"><strong>{locationDecision == null ? "Location decision required" : locationTags.length === 0 ? "No key location selected" : `${locationTags.length} ${locationTags.length === 1 ? "location" : "locations"} selected`}</strong><span lang="zh">{locationDecision == null ? "请选择关键位置或明确选择无关键位置" : locationTags.length === 0 ? "已选择无特别关键位置" : `已选择 ${locationTags.length} 个关键位置`}</span></p>
      </>}

      <footer className="classification-stage-actions">
        <button type="button" className="wizard-back-button" onClick={() => currentIndex === 0 ? onBackToInstrument() : navigateTo(classificationStages[currentIndex - 1].id, "backward")}><span aria-hidden="true">←</span> Back</button>
        {stage === "location_tags" && <button type="button" className="primary-button" disabled={!canContinue} onClick={onContinue}>Continue to Risk &amp; Discipline</button>}
      </footer>
      {stage === "location_tags" && !canContinue && continueDisabledReason && <p className="disabled-action-reason">{continueDisabledReason}</p>}
    </div>
  </section>;
}
