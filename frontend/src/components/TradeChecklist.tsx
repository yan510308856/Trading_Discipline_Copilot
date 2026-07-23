import { useEffect, useMemo, useState } from "react";
import { APIError, evaluateRules, getQuote } from "../api";
import { useCreateTradePlanMutation, useDailyReadinessQuery } from "../hooks/queries";
import type { QuoteResult, RuleEvaluationResult, TradeCreatePayload, TradeFormState } from "../types";
import { parseDecimalInput } from "../utils/decimal";
import { calculateRiskReward, optionUnderlyingDirection } from "../utils/tradeCalculations";
import { optionContractSummary } from "../utils/optionContracts";
import { buildLocalTradeAlerts, statusFromAlerts } from "../utils/tradePlanGate";
import { hashForPage } from "../utils/navigation";
import { ChoiceGroup } from "./ui/ChoiceGroup";
import { entryTriggerOptions, legacyMirrors, locationTagOptions, marketStateOptions, tradeThesisOptions } from "../utils/priceActionTaxonomy";
import { OptionContractSelector } from "./OptionContractSelector";
import { PriceActionClassificationFlow } from "./PriceActionClassificationFlow";
import { RuleAlertPanel } from "./RuleAlertPanel";

export const initialForm: TradeFormState = {
  symbol: "", option_contract: "", option_type: null, option_expiration: "", option_strike: "", option_entry_price: "",
  trade_horizon: "intraday", market: "stocks", direction: "long", setup: "", market_context: "",
  market_state: "", trade_thesis: "", entry_trigger: "", location_tags: [], is_unconfirmed_reversal: false,
  planned_entry: "", stop_loss: "", target_1: "", target_2: "", runner_enabled: false,
  position_size: "", notes: "", follow_through_confirmed: false, recent_stop_loss: false,
  is_immediate_reverse: false, second_leg_entry: false, big_bar_entry: false,
};

const choices = (values: string[]) => values.map((value) => ({ value, label: value.replaceAll("_", " ") }));

export function TradeChecklist() {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [evaluation, setEvaluation] = useState<RuleEvaluationResult>({ status: "allowed", alerts: [] });
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const [partialCreatedTradeId, setPartialCreatedTradeId] = useState<number | null>(null);
  const [planningSessionId] = useState(() => globalThis.crypto?.randomUUID?.() ?? `plan-${Date.now()}`);
  const readinessQuery = useDailyReadinessQuery();
  const createPlanMutation = useCreateTradePlanMutation();
  const readiness = readinessQuery.data ?? null;
  const entry = parseDecimalInput(form.planned_entry), stop = parseDecimalInput(form.stop_loss), target = parseDecimalInput(form.target_1);
  const positionSize = parseDecimalInput(form.position_size);
  const underlyingDirection = form.market === "options"
    ? optionUnderlyingDirection(form.direction, form.option_type)
    : form.direction;
  const riskReward = useMemo(() => entry === null || stop === null || target === null ? null : calculateRiskReward(underlyingDirection, entry, stop, target), [entry, stop, target, underlyingDirection]);
  const target2 = parseDecimalInput(form.target_2);
  const totalRisk = riskReward && positionSize !== null && positionSize > 0 ? riskReward.risk * positionSize : null;
  const target2R = entry === null || stop === null || target2 === null ? null : calculateRiskReward(underlyingDirection, entry, stop, target2).targetR;
  const canonicalOptionContract = form.market === "options" && form.option_type && form.option_expiration && parseDecimalInput(form.option_strike)
    ? optionContractSummary(form.symbol, form.option_expiration, parseDecimalInput(form.option_strike)!, form.option_type)
    : null;

  function update<K extends keyof TradeFormState>(field: K, value: TradeFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
    if (field === "symbol" || field === "market") setQuote(null);
  }

  async function fetchPrice() {
    if (!form.symbol.trim()) return;
    setBusy(true); setError("");
    try { setQuote(await getQuote(form.symbol)); } catch (caught) { setError(caught instanceof APIError ? caught.message : "Price could not be fetched."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void evaluateRules({ status: "planned", trade_horizon: form.trade_horizon, market: form.market, direction: underlyingDirection, market_state: form.market_state || null, trade_thesis: form.trade_thesis || null, entry_trigger: form.entry_trigger || null, location_tags: form.location_tags, is_unconfirmed_reversal: form.is_unconfirmed_reversal, planned_entry: entry, stop_loss: stop, target_1: target, option_contract: canonicalOptionContract, option_type: form.option_type, option_expiration: form.option_expiration || null, option_strike: parseDecimalInput(form.option_strike), follow_through_confirmed: form.follow_through_confirmed, recent_stop_loss: form.recent_stop_loss, is_immediate_reverse: form.is_immediate_reverse, second_leg_entry: form.second_leg_entry, big_bar_entry: form.big_bar_entry }, controller.signal).then(setEvaluation).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError("Could not evaluate rules."); }), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form, entry, stop, target, underlyingDirection]);

  const alerts = [...buildLocalTradeAlerts(form, riskReward, readiness), ...evaluation.alerts];
  const status = statusFromAlerts(alerts);
  const warningGate = status === "warning" && !warningsAcknowledged;
  const step1Valid = Boolean(form.symbol.trim() && form.market && form.direction && form.trade_horizon);
  const step2Valid = Boolean(form.market_state && form.trade_thesis && form.entry_trigger && (form.market !== "options" || (form.option_type && form.option_expiration && parseDecimalInput(form.option_strike))));
  const step2ContinueReason = form.market === "options" && !(form.option_type && form.option_expiration && parseDecimalInput(form.option_strike)) ? "Complete the option contract details before continuing." : "";
  const riskValid = Boolean(riskReward && riskReward.risk > 0 && Number.isFinite(riskReward.targetR));
  const createDisabled = busy || createPlanMutation.isPending || partialCreatedTradeId !== null || status === "blocked" || warningGate || !riskValid || positionSize === null || positionSize <= 0;
  const disabledReason = step === 1 && !form.symbol.trim() ? "Enter a symbol."
    : step === 2 && !form.market_state ? "Choose a market state."
    : step === 2 && !form.trade_thesis ? "Choose a trade thesis."
    : step === 2 && !form.entry_trigger ? "Choose an entry trigger."
    : step === 3 && (positionSize === null || positionSize <= 0) ? "Position size is required."
    : step === 3 && !riskValid ? "Stop loss does not define valid risk."
    : step === 3 && alerts.some((alert) => alert.rule_id === "intraday_daily_readiness_required") ? "Daily readiness is incomplete for an intraday trade."
    : step === 3 && warningGate ? "Review and acknowledge the active warnings."
    : step === 3 && status === "blocked" ? (alerts.find((alert) => alert.severity === "blocker")?.message ?? "Resolve the active blocker rules.")
    : "";
  const planSummary = <div className="plan-summary"><strong>{form.symbol.trim().toUpperCase() || "Symbol"} · {form.market === "options" ? "Options" : form.market} · {form.market === "options" ? `${form.direction === "long" ? "Buy" : "Sell"} ${form.option_type ? form.option_type[0].toUpperCase() + form.option_type.slice(1) : "Option"}` : form.direction} · {form.trade_horizon}</strong>{form.trade_thesis && <span>{tradeThesisOptions.find((item) => item.value === form.trade_thesis)?.english} / {tradeThesisOptions.find((item) => item.value === form.trade_thesis)?.chinese} · {marketStateOptions.find((item) => item.value === form.market_state)?.english} / {marketStateOptions.find((item) => item.value === form.market_state)?.chinese}</span>}{step === 3 && entry !== null && <small>Entry {entry.toFixed(2)} · Stop {stop?.toFixed(2) ?? "—"} · Target {target?.toFixed(2) ?? "—"}</small>}</div>;

  async function recordPlanningAttempt(attempt: string) {
    if (status !== "blocked" && status !== "warning") return;
    try {
      await evaluateRules({ status: "planned", trade_horizon: form.trade_horizon, market: form.market, direction: underlyingDirection, market_state: form.market_state, trade_thesis: form.trade_thesis, entry_trigger: form.entry_trigger, location_tags: form.location_tags, is_unconfirmed_reversal: form.is_unconfirmed_reversal, planned_entry: entry, stop_loss: stop, target_1: target, option_contract: canonicalOptionContract, record_attempt: true, planning_session_id: planningSessionId, idempotency_key: attempt });
    } catch { /* audit failure does not change the discipline gate */ }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "blocked" || warningGate || entry === null || stop === null || target === null) {
      void recordPlanningAttempt("create-attempt");
      return;
    }
    if (status === "warning") void recordPlanningAttempt("warning-final-create");
    setConfirmingCreate(true);
  }

  async function createConfirmed() {
    if (entry === null || stop === null || target === null || positionSize === null || positionSize <= 0) return;
    const payload: TradeCreatePayload = {
      symbol: form.symbol.trim().toUpperCase(), market: form.market, direction: form.direction, trade_horizon: form.trade_horizon,
      ...legacyMirrors(form.market_state as Exclude<typeof form.market_state, "">, form.trade_thesis as Exclude<typeof form.trade_thesis, "">), market_state: form.market_state as Exclude<typeof form.market_state, "">, trade_thesis: form.trade_thesis as Exclude<typeof form.trade_thesis, "">, entry_trigger: form.entry_trigger as Exclude<typeof form.entry_trigger, "">, location_tags: form.location_tags, is_unconfirmed_reversal: form.is_unconfirmed_reversal, planned_entry: entry, stop_loss: stop, target_1: target,
      target_2: parseDecimalInput(form.target_2), position_size: positionSize, runner_enabled: form.runner_enabled,
      notes: form.notes.trim() || null, option_contract: canonicalOptionContract, option_type: form.market === "options" ? form.option_type : null,
      option_expiration: form.market === "options" ? form.option_expiration : null, option_strike: form.market === "options" ? parseDecimalInput(form.option_strike) : null,
      option_entry_price: form.market === "options" ? parseDecimalInput(form.option_entry_price) : null,
    };
    setError("");
    try {
      const result = await createPlanMutation.mutateAsync({ trade: payload, answers: { follow_through_confirmed: form.follow_through_confirmed, recent_stop_loss: form.recent_stop_loss, is_immediate_reverse: form.is_immediate_reverse, second_leg_entry: form.second_leg_entry, big_bar_entry: form.big_bar_entry, runner_enabled: form.runner_enabled } });
      const trade = result.trade;
      if (!result.checklistSaved) {
        setPartialCreatedTradeId(trade.id);
        setConfirmingCreate(false);
        setError(`Trade plan #${trade.id} was created, but checklist answers were not saved. Open the trade and retry the checklist save.`);
        return;
      }
      setMessage(`Trade plan #${trade.id} for ${trade.symbol} was created.`);
      setConfirmingCreate(false);
      setForm(initialForm);
      setStep(1);
      setQuote(null);
      setWarningsAcknowledged(false);
      window.location.hash = hashForPage("open-trades");
    } catch (caught) { setError(caught instanceof APIError ? `${caught.code}: ${caught.message}` : "Could not create the trade plan."); }
    finally { /* mutation exposes pending state */ }
  }

  return <form className="trade-form trade-wizard" onSubmit={submit}>
    <div className="form-heading"><div><p className="eyebrow">Pre-trade</p><h2>Build the plan before taking the risk.</h2></div></div>
    <nav className="wizard-progress" aria-label="Trade plan steps">{["Instrument & Horizon", "Price Action", "Risk & Discipline"].map((label, index) => { const number = index + 1; const completed = number < step; return <button type="button" key={label} className={number === step ? "current" : completed ? "completed" : "incomplete"} disabled={number > step || (number === 2 && !step1Valid)} onClick={() => completed && setStep(number)}><span>{number}</span>{label}</button>; })}</nav>

    <div className={`wizard-step step-${step}`}>
      {step === 1 && <section><h3>Instrument & Horizon</h3><label>Symbol *<input value={form.symbol} onChange={(event) => update("symbol", event.target.value)} maxLength={32} /></label>
        <ChoiceGroup label="Market" choices={choices(["stocks", "options", "futures", "crypto", "forex", "other"]) as {value: TradeFormState["market"]; label: string}[]} value={form.market} onChange={(value) => update("market", value)} />
        <ChoiceGroup label={form.market === "options" ? "Action" : "Direction"} choices={form.market === "options" ? [{value:"long",label:"Buy"},{value:"short",label:"Sell"}] : [{value:"long",label:"Long"},{value:"short",label:"Short"}]} value={form.direction} onChange={(value) => update("direction", value)} />
        <ChoiceGroup label="Trade horizon" choices={[{value:"intraday",label:"Intraday"},{value:"swing",label:"Swing"},{value:"leap",label:"LEAP"},{value:"other",label:"Other"}]} value={form.trade_horizon} onChange={(value) => update("trade_horizon", value)} />
      </section>}
      {step === 2 && <section>{planSummary}<PriceActionClassificationFlow
        marketState={form.market_state}
        tradeThesis={form.trade_thesis}
        entryTrigger={form.entry_trigger}
        locationTags={form.location_tags}
        onMarketStateChange={(value) => setForm((current) => ({ ...current, market_state: value, market_context: legacyMirrors(value, current.trade_thesis || "other").market_context }))}
        onTradeThesisChange={(value) => setForm((current) => ({ ...current, trade_thesis: value, setup: legacyMirrors(current.market_state || "unclear", value).setup, is_unconfirmed_reversal: value === "major_reversal" ? current.is_unconfirmed_reversal : false }))}
        onEntryTriggerChange={(value) => update("entry_trigger", value)}
        onLocationTagsChange={(values) => update("location_tags", values)}
        onBackToInstrument={() => setStep(1)}
        onContinue={() => setStep(3)}
        canContinue={step2Valid}
        continueDisabledReason={step2ContinueReason}
        tradeThesisExtra={form.trade_thesis === "major_reversal" ? <label className="unconfirmed-reversal-control"><input type="checkbox" checked={form.is_unconfirmed_reversal} onChange={(event) => update("is_unconfirmed_reversal", event.target.checked)} /><span><strong>Unconfirmed / left-side reversal attempt</strong><small lang="zh">未确认的左侧反转尝试</small><em>Use this when entering before sufficient reversal confirmation.</em><em lang="zh">在反转确认尚不充分时提前入场，请启用此项。</em></span></label> : null}
        optionPlanningContent={form.market === "options" ? <div className="option-planning-block"><div className="option-quote-toolbar"><div><strong>{form.symbol.trim().toUpperCase() || "Option"} contract</strong><small>Select your date and contract details below.</small></div><button type="button" className="secondary-button" disabled={busy || !form.symbol.trim()} onClick={() => void fetchPrice()}>{busy ? "Fetching…" : "Get strike suggestions"}</button></div><OptionContractSelector symbol={form.symbol} quote={quote} type={form.option_type} expiration={form.option_expiration} strike={form.option_strike} onChange={(values) => setForm((current) => ({ ...current, option_type: values.type ?? current.option_type, option_expiration: values.expiration ?? current.option_expiration, option_strike: values.strike ?? current.option_strike }))} /></div> : null}
      /></section>}
      {step === 3 && <section>
        {planSummary}
        <h3>Risk & Discipline</h3>
        <div className="risk-cockpit">
          <div className="risk-inputs">
            <div className="risk-price-row">
              {(["planned_entry", "stop_loss", "target_1", "target_2"] as const).map((field) => <label key={field}>{field.replaceAll("_", " ")}{field !== "target_2" ? " *" : ""}<input type="number" step="0.01" value={form[field]} onChange={(event) => update(field, event.target.value)} /></label>)}
            </div>
            <label className="position-size-field">Position size *<input type="number" min="0.01" step="0.01" value={form.position_size} onChange={(event) => update("position_size", event.target.value)} /><small>Position size is required because total planned risk cannot be validated without it.</small></label>
            <div className="risk-summary risk-summary-left">
              <div><span>Risk per unit</span><strong>{riskReward?.risk.toFixed(2) ?? "—"}</strong></div>
              <div><span>Position size</span><strong>{positionSize?.toFixed(2) ?? "—"}</strong></div>
              <div><span>Total planned risk</span><strong>{totalRisk?.toFixed(2) ?? "—"}</strong></div>
              <div><span>Target 1 R</span><strong>{riskReward && Number.isFinite(riskReward.targetR) ? `${riskReward.targetR.toFixed(2)}R` : "—"}</strong></div>
              {target2 !== null && <div><span>Target 2 R</span><strong>{target2R !== null && Number.isFinite(target2R) ? `${target2R.toFixed(2)}R` : "—"}</strong></div>}
              <div><span>Decision</span><strong>{status[0].toUpperCase() + status.slice(1)}</strong></div>
            </div>
            <label className="check-row"><input type="checkbox" checked={form.runner_enabled} onChange={(event) => update("runner_enabled", event.target.checked)} />Keep a runner after partial profit</label>
            <div className="check-list"><label className="check-row"><input type="checkbox" checked={form.recent_stop_loss} onChange={(event) => update("recent_stop_loss", event.target.checked)} />Recently stopped out</label>{form.trade_thesis === "breakout" && <label className="check-row"><input type="checkbox" checked={form.follow_through_confirmed} onChange={(event) => update("follow_through_confirmed", event.target.checked)} />Follow-through confirmed</label>}</div>
            <label>Notes<textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
          </div>
          <aside className="risk-decision-panel">
            <RuleAlertPanel status={status} alerts={alerts} />
            <section className="required-action"><span>Required Action</span><strong>{disabledReason || "Review the complete plan before creating it."}</strong></section>
            {status === "warning" && <label className="warning-acknowledgement"><input type="checkbox" checked={warningsAcknowledged} onChange={(event) => setWarningsAcknowledged(event.target.checked)} />I reviewed and accept these warnings.</label>}
          </aside>
        </div>
        <button className="primary-button" disabled={createDisabled || createPlanMutation.isPending || partialCreatedTradeId !== null}>{createPlanMutation.isPending ? "Creating…" : "Create Trade Plan"}</button>
        {createDisabled && disabledReason && <p className="disabled-action-reason">{disabledReason}</p>}
        {partialCreatedTradeId !== null && <a className="secondary-button" href={hashForPage("open-trades")}>Open trade #{partialCreatedTradeId}</a>}
      </section>}
    </div>
    {step !== 2 && <div className="wizard-actions">{step > 1 && <button type="button" className="wizard-back-button" onClick={() => setStep(step - 1)}><span aria-hidden="true">←</span> Back</button>}{step < 3 && <button type="button" className="primary-button" disabled={!step1Valid} onClick={() => setStep(step + 1)}>Continue</button>}</div>}{step === 1 && disabledReason && <p className="disabled-action-reason">{disabledReason}</p>}
    {confirmingCreate && <div className="confirmation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmingCreate(false); }}><section className={`exit-confirmation create-confirmation decision-${status}`} role="dialog" aria-modal="true" aria-labelledby="create-trade-confirmation"><span className="confirmation-icon" aria-hidden="true">✓</span><div><p className="eyebrow">Final plan verification · {status}</p><h3 id="create-trade-confirmation">Create this {form.symbol.trim().toUpperCase()} plan?</h3></div><dl className="exit-confirmation-details"><div><dt>Symbol</dt><dd>{form.symbol.trim().toUpperCase()}</dd></div><div><dt>Market</dt><dd>{form.market}</dd></div><div><dt>{form.market === "options" ? "Action" : "Direction"}</dt><dd>{form.market === "options" ? (form.direction === "long" ? "buy" : "sell") : form.direction}</dd></div><div><dt>Horizon</dt><dd>{form.trade_horizon}</dd></div><div><dt>Market State / 市场结构</dt><dd>{marketStateOptions.find((item) => item.value === form.market_state)?.english} / {marketStateOptions.find((item) => item.value === form.market_state)?.chinese}</dd></div><div><dt>Trade Thesis / 交易逻辑</dt><dd>{tradeThesisOptions.find((item) => item.value === form.trade_thesis)?.english} / {tradeThesisOptions.find((item) => item.value === form.trade_thesis)?.chinese}</dd></div><div><dt>Entry Trigger / 入场触发</dt><dd>{entryTriggerOptions.find((item) => item.value === form.entry_trigger)?.english} / {entryTriggerOptions.find((item) => item.value === form.entry_trigger)?.chinese}</dd></div>{canonicalOptionContract && <div><dt>Option contract</dt><dd>{canonicalOptionContract}</dd></div>}<div><dt>Entry</dt><dd>{entry?.toFixed(2)}</dd></div><div className="critical-plan-fact"><dt>Stop</dt><dd>{stop?.toFixed(2)}</dd></div><div><dt>Target 1</dt><dd>{target?.toFixed(2)}</dd></div><div><dt>Target 2</dt><dd>{target2?.toFixed(2) ?? "—"}</dd></div><div><dt>Position size</dt><dd>{positionSize?.toFixed(2)}</dd></div><div><dt>Risk per unit</dt><dd>{riskReward?.risk.toFixed(2)}</dd></div><div className="critical-plan-fact"><dt>Total planned risk</dt><dd>{totalRisk?.toFixed(2)}</dd></div><div><dt>Planned R/R</dt><dd>{riskReward?.targetR.toFixed(2)}R</dd></div><div><dt>Warning count</dt><dd>{alerts.filter((alert) => alert.severity === "warning").length}</dd></div></dl>{alerts.length > 0 && <ul className="confirmation-warnings">{alerts.map((alert) => <li key={alert.rule_id}>{alert.message}</li>)}</ul>}<div className="confirmation-actions"><button type="button" className="secondary-button" onClick={() => setConfirmingCreate(false)}>Cancel</button><button type="button" className="primary-button" disabled={createDisabled} onClick={() => void createConfirmed()}>{busy ? "Creating…" : "Confirm and create"}</button></div></section></div>}
    {message && <p className="form-message success-message">{message}</p>}{error && <p className="form-message error-message">{error}</p>}
  </form>;
}
