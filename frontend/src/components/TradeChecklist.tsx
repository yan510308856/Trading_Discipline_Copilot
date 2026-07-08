import { useEffect, useMemo, useState } from "react";

import {
  APIError,
  createTrade,
  evaluateRules,
  saveChecklistAnswers,
} from "../api";
import type {
  RuleAlert,
  RuleEvaluationResult,
  RuleStatus,
  TradeCreatePayload,
  TradeFormState,
} from "../types";
import { calculateRiskReward } from "../utils/tradeCalculations";
import { RuleAlertPanel } from "./RuleAlertPanel";

const initialForm: TradeFormState = {
  symbol: "",
  market: "futures",
  direction: "long",
  setup: "",
  market_context: "",
  planned_entry: "",
  stop_loss: "",
  target_1: "",
  target_2: "",
  runner_enabled: false,
  position_size: "",
  notes: "",
  follow_through_confirmed: false,
  recent_stop_loss: false,
  is_immediate_reverse: false,
  second_leg_entry: false,
  big_bar_entry: false,
};

const setups = [
  "breakout",
  "pullback",
  "failed_breakout",
  "reversal",
  "h1_h2_l1_l2",
  "wedge",
  "double_top_bottom",
  "inside_bar_triangle",
  "opening_range",
  "gap_open",
  "other",
];

const marketContexts = [
  "strong_trend",
  "weak_trend",
  "broad_channel",
  "narrow_channel",
  "trading_range",
  "breakout_mode",
  "opening_range",
  "gap_open",
  "uncertain",
];

function optionalNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function localAlert(
  ruleId: string,
  severity: RuleAlert["severity"],
  message: string,
  disciplineSentence: string,
): RuleAlert {
  return {
    rule_id: ruleId,
    severity,
    message,
    checklist: [],
    discipline_sentence: disciplineSentence,
  };
}

export function TradeChecklist() {
  const [form, setForm] = useState<TradeFormState>(initialForm);
  const [evaluation, setEvaluation] = useState<RuleEvaluationResult>({
    status: "allowed",
    alerts: [],
  });
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const entry = optionalNumber(form.planned_entry);
  const stop = optionalNumber(form.stop_loss);
  const target = optionalNumber(form.target_1);

  const riskReward = useMemo(() => {
    if (entry === null || stop === null || target === null) return null;
    return calculateRiskReward(form.direction, entry, stop, target);
  }, [entry, form.direction, stop, target]);

  const localAlerts = useMemo(() => {
    const alerts: RuleAlert[] = [];
    const missingFields = [
      ["symbol", form.symbol],
      ["setup", form.setup],
      ["market context", form.market_context],
      ["planned entry", form.planned_entry],
      ["target 1", form.target_1],
    ].filter(([, value]) => value.trim() === "");

    if (missingFields.length > 0) {
      alerts.push(
        localAlert(
          "complete_required_trade_fields",
          "blocker",
          `Complete required fields: ${missingFields.map(([name]) => name).join(", ")}.`,
          "A complete plan is a prerequisite for a deliberate trade.",
        ),
      );
    }

    if (riskReward && riskReward.risk <= 0) {
      alerts.push(
        localAlert(
          "invalid_trade_risk",
          "blocker",
          "The stop is on the wrong side of entry for this direction.",
          "If the invalidation point does not create positive risk, the structure is not valid.",
        ),
      );
    } else if (riskReward && riskReward.targetR < 1) {
      alerts.push(
        localAlert(
          "low_initial_reward_to_risk",
          "warning",
          "Target 1 offers less than 1R of initial reward.",
          "Small reward should not require full-sized risk.",
        ),
      );
    }

    return alerts;
  }, [form, riskReward]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsEvaluating(true);
      try {
        const result = await evaluateRules(
          {
            status: "planned",
            setup: form.setup,
            market_context: form.market_context,
            planned_entry: entry,
            stop_loss: stop,
            target_1: target,
            follow_through_confirmed: form.follow_through_confirmed,
            recent_stop_loss: form.recent_stop_loss,
            is_immediate_reverse: form.is_immediate_reverse,
            second_leg_entry: form.second_leg_entry,
            big_bar_entry: form.big_bar_entry,
          },
          controller.signal,
        );
        setEvaluation(result);
        setRequestError("");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRequestError(
          error instanceof APIError
            ? `${error.code}: ${error.message}`
            : "Could not evaluate rules. Confirm that the backend is running.",
        );
      } finally {
        if (!controller.signal.aborted) setIsEvaluating(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [entry, form, stop, target]);

  const alerts = [...localAlerts, ...evaluation.alerts];
  const status: RuleStatus = alerts.some(
    (alert) => alert.severity === "blocker",
  )
    ? "blocked"
    : alerts.length > 0
      ? "warning"
      : "allowed";

  function updateField<K extends keyof TradeFormState>(
    field: K,
    value: TradeFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccessMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "blocked" || entry === null || stop === null || target === null) {
      return;
    }

    const payload: TradeCreatePayload = {
      symbol: form.symbol.trim().toUpperCase(),
      market: form.market,
      direction: form.direction,
      setup: form.setup,
      market_context: form.market_context,
      planned_entry: entry,
      stop_loss: stop,
      target_1: target,
      target_2: optionalNumber(form.target_2),
      runner_enabled: form.runner_enabled,
      position_size: optionalNumber(form.position_size),
      notes: form.notes.trim() || null,
    };

    setIsSubmitting(true);
    setRequestError("");
    try {
      const trade = await createTrade(payload);
      await saveChecklistAnswers(trade.id, {
        follow_through_confirmed: form.follow_through_confirmed,
        recent_stop_loss: form.recent_stop_loss,
        is_immediate_reverse: form.is_immediate_reverse,
        second_leg_entry: form.second_leg_entry,
        big_bar_entry: form.big_bar_entry,
        runner_enabled: form.runner_enabled,
      });
      await evaluateRules({
        trade_id: trade.id,
        follow_through_confirmed: form.follow_through_confirmed,
        recent_stop_loss: form.recent_stop_loss,
        is_immediate_reverse: form.is_immediate_reverse,
        second_leg_entry: form.second_leg_entry,
        big_bar_entry: form.big_bar_entry,
      });
      setSuccessMessage(`Trade plan #${trade.id} for ${trade.symbol} was created.`);
    } catch (error) {
      setRequestError(
        error instanceof APIError
          ? `${error.code}: ${error.message}`
          : "Could not create the trade plan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="trade-checklist-layout">
      <form className="trade-form" onSubmit={handleSubmit}>
        <div className="form-heading">
          <div>
            <p className="eyebrow">Pre-trade</p>
            <h2>Build the plan before taking the risk.</h2>
          </div>
          <p>Required fields are marked with an asterisk.</p>
        </div>

        <fieldset>
          <legend>Trade identity</legend>
          <div className="form-grid three-columns">
            <label>
              Symbol *
              <input
                value={form.symbol}
                onChange={(event) => updateField("symbol", event.target.value)}
                placeholder="ES"
                maxLength={32}
              />
            </label>
            <label>
              Market *
              <select
                value={form.market}
                onChange={(event) =>
                  updateField("market", event.target.value as TradeFormState["market"])
                }
              >
                <option value="futures">Futures</option>
                <option value="stocks">Stocks</option>
                <option value="crypto">Crypto</option>
                <option value="forex">Forex</option>
                <option value="options">Options</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Direction *
              <select
                value={form.direction}
                onChange={(event) =>
                  updateField(
                    "direction",
                    event.target.value as TradeFormState["direction"],
                  )
                }
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </label>
          </div>
          <div className="form-grid two-columns">
            <label>
              Setup *
              <select
                value={form.setup}
                onChange={(event) => updateField("setup", event.target.value)}
              >
                <option value="">Select setup</option>
                {setups.map((setup) => (
                  <option value={setup} key={setup}>{setup.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <label>
              Market context *
              <select
                value={form.market_context}
                onChange={(event) =>
                  updateField("market_context", event.target.value)
                }
              >
                <option value="">Select context</option>
                {marketContexts.map((context) => (
                  <option value={context} key={context}>
                    {context.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Risk and targets</legend>
          <div className="form-grid three-columns">
            <label>
              Planned entry *
              <input type="number" step="any" value={form.planned_entry} onChange={(event) => updateField("planned_entry", event.target.value)} />
            </label>
            <label>
              Stop loss *
              <input type="number" step="any" value={form.stop_loss} onChange={(event) => updateField("stop_loss", event.target.value)} />
            </label>
            <label>
              Target 1 *
              <input type="number" step="any" value={form.target_1} onChange={(event) => updateField("target_1", event.target.value)} />
            </label>
            <label>
              Target 2
              <input type="number" step="any" value={form.target_2} onChange={(event) => updateField("target_2", event.target.value)} />
            </label>
            <label>
              Position size
              <input type="number" min="0" step="any" value={form.position_size} onChange={(event) => updateField("position_size", event.target.value)} />
            </label>
          </div>

          <div className={riskReward && riskReward.risk <= 0 ? "risk-summary risk-invalid" : "risk-summary"}>
            <div><span>Risk per unit</span><strong>{riskReward ? riskReward.risk.toFixed(2) : "—"}</strong></div>
            <div><span>Target distance</span><strong>{riskReward ? riskReward.targetDistance.toFixed(2) : "—"}</strong></div>
            <div><span>Planned R/R</span><strong>{riskReward && Number.isFinite(riskReward.targetR) ? `${riskReward.targetR.toFixed(2)}R` : "—"}</strong></div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Discipline context</legend>
          <div className="check-list">
            {form.setup === "breakout" && (
              <label className="check-row"><input type="checkbox" checked={form.follow_through_confirmed} onChange={(event) => updateField("follow_through_confirmed", event.target.checked)} /><span><strong>Follow-through confirmed</strong><small>The breakout has confirmation beyond the initial bar.</small></span></label>
            )}
            <label className="check-row"><input type="checkbox" checked={form.recent_stop_loss} onChange={(event) => updateField("recent_stop_loss", event.target.checked)} /><span><strong>Recently stopped out</strong><small>This plan follows a recent stopped trade.</small></span></label>
            {form.recent_stop_loss && (
              <label className="check-row"><input type="checkbox" checked={form.is_immediate_reverse} onChange={(event) => updateField("is_immediate_reverse", event.target.checked)} /><span><strong>Immediate reverse trade</strong><small>The new plan reverses direction immediately after the stop.</small></span></label>
            )}
            {form.market_context === "trading_range" && (
              <>
                <label className="check-row"><input type="checkbox" checked={form.second_leg_entry} onChange={(event) => updateField("second_leg_entry", event.target.checked)} /><span><strong>Second-leg entry in range</strong><small>Check for disappointment and trap risk.</small></span></label>
                <label className="check-row"><input type="checkbox" checked={form.big_bar_entry} onChange={(event) => updateField("big_bar_entry", event.target.checked)} /><span><strong>Chasing a large range bar</strong><small>Large bars at range extremes can reverse sharply.</small></span></label>
              </>
            )}
            <label className="check-row"><input type="checkbox" checked={form.runner_enabled} onChange={(event) => updateField("runner_enabled", event.target.checked)} /><span><strong>Plan to keep a runner</strong><small>Reserve part of the position for a larger move.</small></span></label>
          </div>
        </fieldset>

        <label className="notes-field">
          Notes
          <textarea rows={4} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Entry reason, invalidation structure, and what would make you wait…" />
        </label>

        {status === "warning" && (
          <p className="warning-confirmation">This plan may be created, but review and consciously accept every warning first.</p>
        )}
        {requestError && <p className="form-message error-message">{requestError}</p>}
        {successMessage && <p className="form-message success-message">{successMessage}</p>}

        <button className="primary-button" type="submit" disabled={status === "blocked" || isEvaluating || isSubmitting}>
          {isSubmitting ? "Creating…" : "Create Trade Plan"}
        </button>
      </form>

      <aside className="evaluation-column">
        <RuleAlertPanel status={status} alerts={alerts} isChecking={isEvaluating} />
      </aside>
    </div>
  );
}
