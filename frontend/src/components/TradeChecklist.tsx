import { useEffect, useMemo, useState } from "react";
import { APIError, createTrade, evaluateRules, getQuote, getTodayDailyReadiness, saveChecklistAnswers } from "../api";
import type { QuoteResult, RuleEvaluationResult, TradeCreatePayload, TradeFormState } from "../types";
import { parseDecimalInput } from "../utils/decimal";
import { calculateRiskReward, optionUnderlyingDirection } from "../utils/tradeCalculations";
import { buildLocalTradeAlerts, statusFromAlerts } from "../utils/tradePlanGate";
import { hashForPage } from "../utils/navigation";
import { ChoiceGroup } from "./ui/ChoiceGroup";
import { OptionContractSelector } from "./OptionContractSelector";
import { RuleAlertPanel } from "./RuleAlertPanel";

export const initialForm: TradeFormState = {
  symbol: "", option_contract: "", option_type: null, option_expiration: "", option_strike: "", option_entry_price: "",
  trade_horizon: "intraday", market: "stocks", direction: "long", setup: "", market_context: "",
  planned_entry: "", stop_loss: "", target_1: "", target_2: "", runner_enabled: false,
  position_size: "", notes: "", follow_through_confirmed: false, recent_stop_loss: false,
  is_immediate_reverse: false, second_leg_entry: false, big_bar_entry: false,
};

export const setups = ["breakout", "pullback", "failed_breakout", "reversal", "left_side_bottom_pick", "early_reversal", "bottom_pick", "h1_h2_l1_l2", "wedge", "double_top_bottom", "inside_bar_triangle", "opening_range", "gap_open", "other"];
const contexts = ["strong_trend", "weak_trend", "broad_channel", "narrow_channel", "trading_range", "breakout_mode", "opening_range", "gap_open", "uncertain"];
const choices = (values: string[]) => values.map((value) => ({ value, label: value.replaceAll("_", " ") }));

export function TradeChecklist() {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [evaluation, setEvaluation] = useState<RuleEvaluationResult>({ status: "allowed", alerts: [] });
  const [readiness, setReadiness] = useState<Awaited<ReturnType<typeof getTodayDailyReadiness>> | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const entry = parseDecimalInput(form.planned_entry), stop = parseDecimalInput(form.stop_loss), target = parseDecimalInput(form.target_1);
  const positionSize = parseDecimalInput(form.position_size);
  const underlyingDirection = form.market === "options"
    ? optionUnderlyingDirection(form.direction, form.option_type)
    : form.direction;
  const riskReward = useMemo(() => entry === null || stop === null || target === null ? null : calculateRiskReward(underlyingDirection, entry, stop, target), [entry, stop, target, underlyingDirection]);

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

  useEffect(() => { void getTodayDailyReadiness().then(setReadiness).catch(() => setReadiness(null)); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void evaluateRules({ status: "planned", trade_horizon: form.trade_horizon, market: form.market, direction: underlyingDirection, setup: form.setup, market_context: form.market_context, planned_entry: entry, stop_loss: stop, target_1: target, follow_through_confirmed: form.follow_through_confirmed, recent_stop_loss: form.recent_stop_loss, is_immediate_reverse: form.is_immediate_reverse, second_leg_entry: form.second_leg_entry, big_bar_entry: form.big_bar_entry }, controller.signal).then(setEvaluation).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError("Could not evaluate rules."); }), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form, entry, stop, target, underlyingDirection]);

  const alerts = [...buildLocalTradeAlerts(form, riskReward, readiness), ...evaluation.alerts];
  const status = statusFromAlerts(alerts);
  const warningGate = status === "warning" && !warningsAcknowledged;
  const step1Valid = Boolean(form.symbol.trim() && form.market && form.direction && form.trade_horizon);
  const step2Valid = Boolean(form.setup && form.market_context && (form.market !== "options" || (form.option_type && form.option_expiration && parseDecimalInput(form.option_strike))));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "blocked" || warningGate || entry === null || stop === null || target === null) return;
    setConfirmingCreate(true);
  }

  async function createConfirmed() {
    if (entry === null || stop === null || target === null) return;
    const payload: TradeCreatePayload = {
      symbol: form.symbol.trim().toUpperCase(), market: form.market, direction: form.direction, trade_horizon: form.trade_horizon,
      setup: form.setup, market_context: form.market_context, planned_entry: entry, stop_loss: stop, target_1: target,
      target_2: parseDecimalInput(form.target_2), position_size: parseDecimalInput(form.position_size), runner_enabled: form.runner_enabled,
      notes: form.notes.trim() || null, option_contract: null, option_type: form.market === "options" ? form.option_type : null,
      option_expiration: form.market === "options" ? form.option_expiration : null, option_strike: form.market === "options" ? parseDecimalInput(form.option_strike) : null,
      option_entry_price: form.market === "options" ? parseDecimalInput(form.option_entry_price) : null,
    };
    setBusy(true); setError("");
    try {
      const trade = await createTrade(payload);
      await saveChecklistAnswers(trade.id, { follow_through_confirmed: form.follow_through_confirmed, recent_stop_loss: form.recent_stop_loss, is_immediate_reverse: form.is_immediate_reverse, second_leg_entry: form.second_leg_entry, big_bar_entry: form.big_bar_entry, runner_enabled: form.runner_enabled });
      setMessage(`Trade plan #${trade.id} for ${trade.symbol} was created.`);
      setConfirmingCreate(false);
      setForm(initialForm);
      setStep(1);
      setQuote(null);
      setWarningsAcknowledged(false);
      window.location.hash = hashForPage("open-trades");
    } catch (caught) { setError(caught instanceof APIError ? `${caught.code}: ${caught.message}` : "Could not create the trade plan."); }
    finally { setBusy(false); }
  }

  return <form className="trade-form trade-wizard" onSubmit={submit}>
    <div className="form-heading"><div><p className="eyebrow">Pre-trade</p><h2>Build the plan before taking the risk.</h2></div></div>
    <nav className="wizard-progress" aria-label="Trade plan steps">{["Instrument & Horizon", "Setup & Context", "Risk & Discipline"].map((label, index) => { const number = index + 1; const completed = number < step; return <button type="button" key={label} className={number === step ? "current" : completed ? "completed" : "incomplete"} disabled={number > step || (number === 2 && !step1Valid)} onClick={() => completed && setStep(number)}><span>{number}</span>{label}</button>; })}</nav>

    <div className={`wizard-step step-${step}`}>
      {step === 1 && <section><h3>Instrument & Horizon</h3><label>Symbol *<input value={form.symbol} onChange={(event) => update("symbol", event.target.value)} maxLength={32} /></label>
        <ChoiceGroup label="Market" choices={choices(["stocks", "options", "futures", "crypto", "forex", "other"]) as {value: TradeFormState["market"]; label: string}[]} value={form.market} onChange={(value) => update("market", value)} />
        <ChoiceGroup label={form.market === "options" ? "Action" : "Direction"} choices={form.market === "options" ? [{value:"long",label:"Buy"},{value:"short",label:"Sell"}] : [{value:"long",label:"Long"},{value:"short",label:"Short"}]} value={form.direction} onChange={(value) => update("direction", value)} />
        <ChoiceGroup label="Trade horizon" choices={[{value:"intraday",label:"Intraday"},{value:"swing",label:"Swing"},{value:"leap",label:"LEAP"},{value:"other",label:"Other"}]} value={form.trade_horizon} onChange={(value) => update("trade_horizon", value)} />
      </section>}
      {step === 2 && <section><h3>Setup & Context</h3>
        <ChoiceGroup label="Setup" choices={choices(setups)} value={form.setup || null} onChange={(value) => update("setup", value)} />
        <ChoiceGroup label="Market context" choices={choices(contexts)} value={form.market_context || null} onChange={(value) => update("market_context", value)} />
        {form.market === "options" && <div className="option-planning-block"><div className="option-quote-toolbar"><div><strong>{form.symbol.trim().toUpperCase() || "Option"} contract</strong><small>Select your date and contract details below.</small></div><button type="button" className="secondary-button" disabled={busy || !form.symbol.trim()} onClick={() => void fetchPrice()}>{busy ? "Fetching…" : "Get strike suggestions"}</button></div><OptionContractSelector symbol={form.symbol} quote={quote} type={form.option_type} expiration={form.option_expiration} strike={form.option_strike} onChange={(values) => setForm((current) => ({ ...current, option_type: values.type ?? current.option_type, option_expiration: values.expiration ?? current.option_expiration, option_strike: values.strike ?? current.option_strike }))} /></div>}
      </section>}
      {step === 3 && <section><h3>Risk & Discipline</h3><div className="form-grid three-columns">
        {["planned_entry", "stop_loss", "target_1", "target_2", "position_size"].map((field) => <label key={field}>{field.replaceAll("_", " ")}{["planned_entry","stop_loss","target_1"].includes(field) ? " *" : ""}<input type="number" step="0.01" value={String(form[field as keyof TradeFormState])} onChange={(event) => update(field as "planned_entry", event.target.value)} /></label>)}
      </div>
      <div className="risk-summary"><div><span>Risk per unit</span><strong>{riskReward?.risk.toFixed(2) ?? "—"}</strong></div><div><span>Planned R/R</span><strong>{riskReward && Number.isFinite(riskReward.targetR) ? `${riskReward.targetR.toFixed(2)}R` : "—"}</strong></div><div><span>Total planned risk</span><strong>{riskReward && positionSize !== null ? (riskReward.risk * positionSize).toFixed(2) : "—"}</strong></div></div>
      <div className="check-list"><label className="check-row"><input type="checkbox" checked={form.recent_stop_loss} onChange={(event) => update("recent_stop_loss", event.target.checked)} />Recently stopped out</label>{form.setup === "breakout" && <label className="check-row"><input type="checkbox" checked={form.follow_through_confirmed} onChange={(event) => update("follow_through_confirmed", event.target.checked)} />Follow-through confirmed</label>}</div>
      <RuleAlertPanel status={status} alerts={alerts} />{status === "warning" && <label className="warning-acknowledgement"><input type="checkbox" checked={warningsAcknowledged} onChange={(event) => setWarningsAcknowledged(event.target.checked)} />I reviewed and accept these warnings.</label>}
      <label>Notes<textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label><button className="primary-button" disabled={busy || status === "blocked" || warningGate || entry === null || stop === null || target === null}>Create Trade Plan</button>
      </section>}
    </div>
    <div className="wizard-actions">{step > 1 && <button type="button" className="wizard-back-button" onClick={() => setStep(step - 1)}><span aria-hidden="true">←</span> Back</button>}{step < 3 && <button type="button" className="primary-button" disabled={step === 1 ? !step1Valid : !step2Valid} onClick={() => setStep(step + 1)}>Continue</button>}</div>
    {confirmingCreate && <div className="confirmation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmingCreate(false); }}><section className="exit-confirmation create-confirmation" role="dialog" aria-modal="true" aria-labelledby="create-trade-confirmation"><span className="confirmation-icon" aria-hidden="true">✓</span><div><p className="eyebrow">Create trade plan</p><h3 id="create-trade-confirmation">Create this {form.symbol.trim().toUpperCase()} plan?</h3></div><dl className="exit-confirmation-details"><div><dt>Market</dt><dd>{form.market}</dd></div><div><dt>{form.market === "options" ? "Action" : "Direction"}</dt><dd>{form.market === "options" ? (form.direction === "long" ? "buy" : "sell") : form.direction}</dd></div><div><dt>Entry</dt><dd>{form.planned_entry}</dd></div><div><dt>Position size</dt><dd>{form.position_size || "—"}</dd></div></dl><p className="create-clear-note">After creation, this form will be cleared for the next trade.</p><div className="confirmation-actions"><button type="button" className="secondary-button" onClick={() => setConfirmingCreate(false)}>Cancel</button><button type="button" className="primary-button" disabled={busy} onClick={() => void createConfirmed()}>{busy ? "Creating…" : "Confirm and create"}</button></div></section></div>}
    {message && <p className="form-message success-message">{message}</p>}{error && <p className="form-message error-message">{error}</p>}
  </form>;
}
