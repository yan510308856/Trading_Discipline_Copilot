import { useEffect, useMemo, useState } from "react";

import {
  evaluateRules,
} from "../api";
import { useTrades } from "../hooks/useTrades";
import type {
  AddReason,
  RuleAlert,
  RuleEvaluationResult,
  Trade,
  TradePatchPayload,
  ExitReason,
  TradeHorizon,
} from "../types";
import { formatDecimal, parseDecimalInput } from "../utils/decimal";
import { groupTradesByMarket } from "../utils/tradeGrouping";
import {
  calculateAddPositionPreview,
  calculateAggregateUnderlyingR,
  calculateCurrentR,
  optionUnderlyingDirection,
  resolvedUnderlyingDirection,
} from "../utils/tradeCalculations";
import { PriceLadder } from "./PriceLadder";
import { PriceFreshness } from "./PriceFreshness";
import { RuleAlertPanel } from "./RuleAlertPanel";
import { PriceActionClassification } from "./PriceActionClassification";
import { DeleteTradeButton } from "./DeleteTradeButton";
import {
  HorizonFilter,
  type HorizonFilterValue,
  horizonForApi,
} from "./HorizonFilter";
import { useAddPositionMutation, useChangeTradeHorizonMutation, useDismissWarningMutation, useOpenTradeMutation, usePatchTradeMutation, usePriceAlertEventsQuery, useRecordExitMutation, useUndoWarningDismissalMutation } from "../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { contextFromHash, hashWithContext, positiveIntegerContext } from "../utils/navigation";
import { frontendErrorMessage } from "../utils/apiError";

interface TradeCardProps {
  trade: Trade;
  onUpdated: (trade: Trade) => void;
  defaultExpanded: boolean;
  onDeleted: (tradeId: number) => void;
  onAutoClosed: (trade: Trade) => void;
}

function numberOrNull(value: string): number | null {
  return parseDecimalInput(value);
}

interface EditableMetricProps {
  label: string;
  value: number | null;
  onSave: (value: number | null) => Promise<void>;
  required?: boolean;
}

function EditableMetric({
  label,
  value,
  onSave,
  required = false,
}: EditableMetricProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const parsedDraft = numberOrNull(draft);
  const canSave = required
    ? parsedDraft !== null
    : draft.trim() === "" || parsedDraft !== null;

  useEffect(() => {
    if (!isEditing) setDraft(value?.toString() ?? "");
  }, [isEditing, value]);

  async function save() {
    if (!canSave) return;
    await onSave(draft.trim() === "" ? null : parsedDraft);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="editable-metric editing">
        <span>{label}</span>
        <input
          aria-label={label}
          autoFocus
          type="number"
          step="0.01"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
            if (event.key === "Escape") setIsEditing(false);
          }}
        />
        <div className="metric-edit-actions">
          <button type="button" disabled={!canSave} onClick={() => void save()}>
            Save
          </button>
          <button type="button" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editable-metric">
      <span>{label}</span>
      <button type="button" onClick={() => setIsEditing(true)}>
        {value === null ? "—" : formatDecimal(value)}
      </button>
    </div>
  );
}

function displayPrice(value: number | null): string {
  return value === null ? "—" : formatDecimal(value);
}

function tradeDirectionLabel(trade: Trade): string {
  if (trade.market === "options") {
    return trade.direction === "long" ? "Buy" : "Sell";
  }
  return trade.direction === "long" ? "Long" : "Short";
}

export function tradingViewUrl(symbol: string): string {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(
    symbol.trim().toUpperCase(),
  )}`;
}

export function robinhoodUrl(symbol: string): string {
  return `https://robinhood.com/stocks/${encodeURIComponent(
    symbol.trim().toUpperCase(),
  )}`;
}

export type TradeSort = "opened" | "symbol" | "current_r";

export function currentUnderlyingRForTrade(trade: Trade): number | null {
  if (trade.current_price === null) return null;
  const entry = trade.actual_entry ?? trade.planned_entry;
  const direction = trade.market === "options"
    ? resolvedUnderlyingDirection(
        trade.direction,
        trade.option_type,
        entry,
        trade.stop_loss,
      )
    : trade.direction;
  const aggregate = calculateAggregateUnderlyingR(
    direction,
    trade.entry_executions,
    trade.executions,
    trade.current_price,
  );
  const value = aggregate ?? calculateCurrentR(
    direction,
    entry,
    trade.stop_loss,
    trade.current_price,
  );
  return Number.isFinite(value) ? value : null;
}

export function sortActiveTrades(
  trades: Trade[],
  sortBy: TradeSort,
): Trade[] {
  return [...trades].sort((left, right) => {
    const statusDifference =
      Number(right.status === "open") - Number(left.status === "open");
    if (statusDifference !== 0) return statusDifference;

    if (sortBy === "symbol") {
      return left.symbol.localeCompare(right.symbol) || right.id - left.id;
    }
    if (sortBy === "current_r") {
      const leftR = currentUnderlyingRForTrade(left);
      const rightR = currentUnderlyingRForTrade(right);
      if (leftR === null && rightR !== null) return 1;
      if (leftR !== null && rightR === null) return -1;
      if (leftR !== null && rightR !== null && leftR !== rightR) {
        return rightR - leftR;
      }
      return left.symbol.localeCompare(right.symbol) || right.id - left.id;
    }

    const leftOpened = left.opened_at ?? left.created_at;
    const rightOpened = right.opened_at ?? right.created_at;
    return rightOpened.localeCompare(leftOpened) || right.id - left.id;
  });
}

function errorMessage(error: unknown): string {
  return frontendErrorMessage(error, "The trade update failed. Confirm that the backend is running.");
}

const alertPriority: Record<RuleAlert["severity"], number> = {
  blocker: 3,
  warning: 2,
  reminder: 1,
};

function requiredAction(alerts: RuleAlert[]): RuleAlert | null {
  return [...alerts].sort(
    (left, right) =>
      alertPriority[right.severity] - alertPriority[left.severity],
  )[0] ?? null;
}

function requiredActionText(alert: RuleAlert | null): string {
  if (!alert) return "Monitor the trade against the original plan.";
  const hintedAction = alert.ui_hints?.required_action;
  if (typeof hintedAction === "string") return hintedAction;
  if (alert.next_actions && alert.next_actions.length > 0) {
    return alert.next_actions[0];
  }

  const fallbackActions: Record<string, string> = {
    runner_must_have_protection: "Set runner stop.",
    take_profit_and_let_runner_run:
      "Decide whether to take partial profit.",
    green_trade_should_not_go_red: "Reassess management plan.",
  };
  return fallbackActions[alert.rule_id] ?? alert.message;
}

function TradeCard({ trade, onUpdated, defaultExpanded, onDeleted, onAutoClosed }: TradeCardProps) {
  const priceAlerts = usePriceAlertEventsQuery(trade.id);
  const patchMutation = usePatchTradeMutation();
  const openMutation = useOpenTradeMutation();
  const exitMutation = useRecordExitMutation();
  const addMutation = useAddPositionMutation();
  const horizonMutation = useChangeTradeHorizonMutation();
  const dismissWarningMutation = useDismissWarningMutation();
  const undoDismissalMutation = useUndoWarningDismissalMutation();
  const [actualEntry, setActualEntry] = useState(
    trade.actual_entry?.toString() ?? trade.planned_entry.toString(),
  );
  const [currentPrice, setCurrentPrice] = useState(
    trade.current_price?.toString() ?? "",
  );
  const [plannedOptionEntry, setPlannedOptionEntry] = useState(
    trade.option_entry_price?.toString() ?? "",
  );
  const [currentStop, setCurrentStop] = useState(
    trade.current_stop?.toString() ?? trade.stop_loss.toString(),
  );
  const [runnerStop, setRunnerStop] = useState(
    trade.runner_stop?.toString() ?? "",
  );
  const [partialQuantity, setPartialQuantity] = useState("");
  const [partialPrice, setPartialPrice] = useState("");
  const [note, setNote] = useState(trade.notes ?? "");
  const [exitReason, setExitReason] = useState<ExitReason>("partial_profit");
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [evaluation, setEvaluation] = useState<RuleEvaluationResult>({
    status: "allowed",
    alerts: [],
  });
  const [optionExitPrice, setOptionExitPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [undoDismissalKey, setUndoDismissalKey] = useState<string | null>(null);
  const [pendingHorizon, setPendingHorizon] = useState<TradeHorizon | null>(null);
  const [isEditingHorizon, setIsEditingHorizon] = useState(false);
  const [addPrice, setAddPrice] = useState(
    trade.current_price === null ? "" : formatDecimal(trade.current_price),
  );
  const [addQuantity, setAddQuantity] = useState("");
  const [addStop, setAddStop] = useState(
    trade.current_stop === null ? "" : formatDecimal(trade.current_stop),
  );
  const [addOptionPrice, setAddOptionPrice] = useState("");
  const [addReason, setAddReason] = useState<AddReason>("breakout_confirmation");
  const [addNotes, setAddNotes] = useState("");
  const [confirmingAdd, setConfirmingAdd] = useState(false);
  const [losingAddAcknowledged, setLosingAddAcknowledged] = useState(false);
  const [addNotice, setAddNotice] = useState("");

  async function dismissOpenWarning(alert: RuleAlert) {
    if (!alert.dismissal_key || !alert.occurrence_key) return;
    const prior = evaluation;
    const nextAlerts = evaluation.alerts.filter((item) => item.dismissal_key !== alert.dismissal_key);
    setEvaluation({
      status: nextAlerts.some((item) => item.severity === "blocker") ? "blocked" : nextAlerts.length ? "warning" : "allowed",
      alerts: nextAlerts,
    });
    setUndoDismissalKey(alert.dismissal_key);
    try {
      await dismissWarningMutation.mutateAsync({
        dismissalKey: alert.dismissal_key,
        occurrenceKey: alert.occurrence_key,
      });
    } catch {
      setEvaluation(prior);
      setUndoDismissalKey(null);
      setError("Warning could not be dismissed.");
    }
  }

  async function undoOpenWarning() {
    if (!undoDismissalKey) return;
    try {
      await undoDismissalMutation.mutateAsync(undoDismissalKey);
      setUndoDismissalKey(null);
    } catch {
      setError("Warning dismissal could not be undone.");
      return;
    }
    try {
      const restored = await evaluateRules({
        trade_id: trade.id,
        current_r: currentR,
        partial_taken: trade.partial_taken,
        runner_active: trade.runner_active,
        runner_stop: numberOrNull(runnerStop),
      });
      setEvaluation(restored);
    } catch {
      setError("Warning was restored, but the rule panel could not refresh.");
    }
  }

  const parsedEntry = numberOrNull(actualEntry);
  const parsedPlannedOptionEntry = numberOrNull(plannedOptionEntry);
  const parsedPrice = numberOrNull(currentPrice);
  const currentR = useMemo(() => {
    if (parsedEntry === null || parsedPrice === null) return null;
    const underlyingDirection = trade.market === "options"
      ? resolvedUnderlyingDirection(
          trade.direction,
          trade.option_type,
          parsedEntry,
          trade.stop_loss,
        )
      : trade.direction;
    const aggregate = calculateAggregateUnderlyingR(
      underlyingDirection,
      trade.entry_executions,
      trade.executions,
      parsedPrice,
    );
    const value = aggregate ?? calculateCurrentR(
      underlyingDirection, parsedEntry, trade.stop_loss, parsedPrice,
    );
    return Number.isFinite(value) ? value : null;
  }, [parsedEntry, parsedPrice, trade.direction, trade.entry_executions, trade.executions, trade.market, trade.option_type, trade.stop_loss]);
  const quantity = {
    initial: trade.position_summary.initial_quantity,
    taken: trade.position_summary.total_exit_quantity,
    runner: trade.position_summary.remaining_quantity,
  };
  const partialExitLevels = trade.executions
    .filter((item) => item.execution_type === "partial")
    .map((item) => ({ price: item.price, quantity: item.quantity }));
  const activeStopForMap =
    trade.runner_active && trade.runner_stop !== null
      ? trade.runner_stop
      : numberOrNull(currentStop);
  const parsedPartialQuantity = numberOrNull(partialQuantity);
  const parsedPartialPrice = numberOrNull(partialPrice);
  const parsedOptionExitPrice = numberOrNull(optionExitPrice);
  const partialQuantityIsValid =
    parsedPartialQuantity !== null &&
    parsedPartialQuantity > 0 &&
    parsedPartialQuantity <= quantity.runner;
  const primaryRequiredAction = trade.position_size === null
    ? ({ rule_id: "position_size_required", severity: "blocker", message: "Position size is required before recording exits.", checklist: [], discipline_sentence: "", next_actions: ["Set position size before recording exits."] } as RuleAlert)
    : requiredAction(evaluation.alerts);

  useEffect(() => {
    if (trade.status !== "open") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await evaluateRules(
          {
            trade_id: trade.id,
            current_r: currentR,
            partial_taken: trade.partial_taken,
            runner_active: trade.runner_active,
            runner_stop: numberOrNull(runnerStop),
          },
          controller.signal,
        );
        setEvaluation(result);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError(errorMessage(requestError));
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentR, runnerStop, trade.id, trade.partial_taken, trade.runner_active, trade.status]);

  async function runAction(action: () => Promise<Trade>) {
    setIsSaving(true);
    setError("");
    try {
      onUpdated(await action());
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  function update(updates: TradePatchPayload) {
    return runAction(() => patchMutation.mutateAsync({ tradeId: trade.id, updates }));
  }

  function updateExitQuantity(value: string) {
    const requested = numberOrNull(value);
    if (requested === null) {
      setPartialQuantity(value);
      return;
    }
    const remaining = quantity.runner ?? 0;
    setPartialQuantity(requested > remaining ? formatDecimal(remaining) : value);
  }

  async function changeHorizon() {
    if (pendingHorizon === null) return;
    await runAction(() => horizonMutation.mutateAsync({
      tradeId: trade.id,
      tradeHorizon: pendingHorizon,
    }));
    setPendingHorizon(null);
    setIsEditingHorizon(false);
  }

  const parsedAddPrice = numberOrNull(addPrice);
  const parsedAddQuantity = numberOrNull(addQuantity);
  const parsedAddStop = numberOrNull(addStop);
  const parsedAddOptionPrice = numberOrNull(addOptionPrice);
  const addDirection = optionUnderlyingDirection(
    trade.direction, trade.market === "options" ? trade.option_type : null,
  );
  const addRiskIsValid = parsedAddPrice !== null && parsedAddStop !== null && (
    addDirection === "long"
      ? parsedAddStop < parsedAddPrice
      : parsedAddStop > parsedAddPrice
  );
  const addPreview = (
    parsedAddPrice !== null
    && parsedAddQuantity !== null
    && parsedAddQuantity > 0
    && parsedAddStop !== null
    && trade.position_summary.weighted_average_entry !== null
  ) ? calculateAddPositionPreview(
      trade.position_summary.total_entry_quantity,
      trade.position_summary.remaining_quantity,
      trade.position_summary.weighted_average_entry,
      trade.position_summary.total_underlying_risk,
      parsedAddPrice,
      parsedAddQuantity,
      parsedAddStop,
    ) : null;
  const addBlocked = trade.current_stop === null
    || trade.reversal_confirmation === "unconfirmed"
    || trade.is_unconfirmed_reversal
    || !trade.position_summary.accounting_consistent
    || !addRiskIsValid;
  const losingAddWarning = currentR !== null && currentR < 0;

  async function saveAddPosition() {
    if (
      parsedAddPrice === null
      || parsedAddQuantity === null
      || parsedAddStop === null
      || addPreview === null
    ) return;
    setIsSaving(true);
    setError("");
    try {
      const updated = await addMutation.mutateAsync({
        tradeId: trade.id,
        payload: {
          underlying_price: parsedAddPrice,
          quantity: parsedAddQuantity,
          stop_at_entry: parsedAddStop,
          reason: addReason,
          option_price: trade.market === "options" ? parsedAddOptionPrice : null,
          notes: addNotes.trim() || null,
          warnings_acknowledged: losingAddAcknowledged
            ? ["adding_while_losing"]
            : [],
        },
      });
      onUpdated(updated);
      setCurrentStop(updated.current_stop === null ? "" : formatDecimal(updated.current_stop));
      setAddStop(updated.current_stop === null ? "" : formatDecimal(updated.current_stop));
      setAddQuantity("");
      setAddOptionPrice("");
      setAddNotes("");
      setConfirmingAdd(false);
      setLosingAddAcknowledged(false);
      setAddNotice("Position addition recorded locally. No broker order was placed.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  const horizonControl = (
    <div className="horizon-edit-control">
      <span>Horizon</span>
      {isEditingHorizon ? (
        <select
          aria-label={`Change horizon for ${trade.symbol}`}
          defaultValue={trade.trade_horizon}
          autoFocus
          onBlur={() => setIsEditingHorizon(false)}
          onChange={(event) => {
            const next = event.target.value as TradeHorizon;
            setIsEditingHorizon(false);
            if (next !== trade.trade_horizon) setPendingHorizon(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsEditingHorizon(false);
          }}
        >
          <option value="intraday">Intraday</option>
          <option value="swing">Swing</option>
          <option value="leap">LEAP</option>
          <option value="other">Other</option>
        </select>
      ) : (
        <button
          type="button"
          className="metric-edit-button"
          aria-label={`Edit horizon for ${trade.symbol}`}
          onClick={() => setIsEditingHorizon(true)}
        >
          {trade.trade_horizon}
        </button>
      )}
    </div>
  );
  const horizonConfirmation = pendingHorizon !== null && (
    <div className="confirmation-backdrop" role="presentation">
      <section
        className="exit-confirmation"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`horizon-confirmation-${trade.id}`}
      >
        <div>
          <p className="eyebrow">Classification change</p>
          <h3 id={`horizon-confirmation-${trade.id}`}>
            Change trade horizon?
          </h3>
        </div>
        <p className="horizon-change-value">
          {trade.trade_horizon} → {pendingHorizon}
        </p>
        <p>
          This updates filtering, Attention, and Analytics. It does not alter
          entry, stop, targets, or execution history.
        </p>
        {trade.status === "open" && pendingHorizon === "intraday" && (
          <p className="readiness-information">
            Daily Readiness applies when creating a new intraday plan. This open
            trade remains manageable after reclassification.
          </p>
        )}
        <div className="confirmation-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPendingHorizon(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={isSaving}
            onClick={() => void changeHorizon()}
          >
            {isSaving ? "Saving…" : "Confirm change"}
          </button>
        </div>
      </section>
    </div>
  );

  let runningQuantity = 0;
  const unifiedExecutionHistory = [
    ...trade.entry_executions.map((entry) => ({
      id: `entry-${entry.id}`,
      timestamp: entry.executed_at,
      action: entry.entry_kind === "initial" ? "Initial entry" : "Add position",
      price: entry.underlying_price,
      quantity: entry.quantity,
      optionPrice: entry.option_price,
      reason: entry.reason,
      stop: entry.stop_at_entry,
      delta: entry.quantity,
    })),
    ...trade.executions.map((execution) => ({
      id: `exit-${execution.id}`,
      timestamp: execution.executed_at,
      action: execution.execution_type === "final" ? "Final exit" : "Partial exit",
      price: execution.price,
      quantity: execution.quantity ?? 0,
      optionPrice: execution.option_price,
      reason: execution.exit_reason ?? "other",
      stop: null,
      delta: -(execution.quantity ?? 0),
    })),
  ]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .map((event) => {
      runningQuantity = Math.max(0, runningQuantity + event.delta);
      return { ...event, remaining: runningQuantity };
    });

  async function savePartialExit() {
    if (parsedPartialQuantity === null || parsedPartialPrice === null) return;
    setIsSaving(true);
    setError("");
    try {
      const updated = await exitMutation.mutateAsync({ tradeId: trade.id, price: parsedPartialPrice, quantity: parsedPartialQuantity, exitReason, optionPrice: trade.market === "options" ? parsedOptionExitPrice : null });
      onUpdated(updated);
      if (updated.status === "closed") onAutoClosed(updated);
      setConfirmingExit(false);
      setPartialPrice("");
      setPartialQuantity("");
      setOptionExitPrice("");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  if (trade.status === "planned") {
    return (
      <details id={`trade-${trade.id}`} className="trade-accordion planned-trade-card" open={defaultExpanded}>
        <summary className="trade-summary">
          <div className="trade-summary-primary">
            <div>
              <p className="eyebrow">Planned trade #{trade.id}</p>
              <h2>{trade.symbol} <span>{tradeDirectionLabel(trade)}</span></h2>
            </div>
            <div className="trade-link-actions">
              <a
                className="chart-link-button"
                href={tradingViewUrl(trade.symbol)}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                Chart
              </a>
              <a
                className="chart-link-button broker-link-button"
                href={robinhoodUrl(trade.symbol)}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                RH {trade.symbol}
              </a>
            </div>
          </div>
          <span className="trade-status planned">Planned</span>
        </summary>
        <article className="open-trade-card">
        <PriceActionClassification trade={trade} compact englishOnly />
        <div className="trade-facts compact-facts cockpit-metrics">
          {horizonControl}
          <div><span>Planned entry</span><strong>{trade.planned_entry}</strong></div>
          <div><span>Initial stop</span><strong>{trade.stop_loss}</strong></div>
          <div><span>Target 1</span><strong>{trade.target_1}</strong></div>
          <EditableMetric label="Position size" value={trade.position_size} required onSave={(value) => update({ position_size: value })} />
          {trade.option_contract && (
            <div><span>Option contract</span><strong>{trade.option_contract}</strong></div>
          )}
        </div>
        <div className="inline-action">
          <label>
            Actual entry
            <input
              aria-label={`Actual entry for ${trade.symbol}`}
              type="number"
              step="any"
              value={actualEntry}
              onChange={(event) => setActualEntry(event.target.value)}
            />
          </label>
          {trade.market === "options" && <label>Option entry price<input aria-label={`Option entry price for ${trade.symbol}`} type="number" min="0.01" step="0.01" value={plannedOptionEntry} onChange={(event) => setPlannedOptionEntry(event.target.value)} /></label>}
          <button
            className="primary-button"
            disabled={isSaving || parsedEntry === null || trade.position_size === null || (trade.market === "options" && parsedPlannedOptionEntry === null)}
            onClick={() => runAction(() => openMutation.mutateAsync({ tradeId: trade.id, actualEntry: parsedEntry, optionEntryPrice: parsedPlannedOptionEntry }))}
          >
            {isSaving ? "Opening…" : "Mark Entry Filled"}
          </button>
          {trade.position_size === null && <small className="form-message error-message">Set position size before marking the entry filled.</small>}
        </div>
        {error && <p className="form-message error-message">{error}</p>}
        {horizonConfirmation}
        <DeleteTradeButton trade={trade} onDeleted={onDeleted} />
        </article>
      </details>
    );
  }

  return (
    <details id={`trade-${trade.id}`} className="trade-accordion" open={defaultExpanded}>
      <summary className="trade-summary">
        <div className="trade-summary-primary">
          <div>
            <p className="eyebrow">Open trade #{trade.id}</p>
            <h2>{trade.symbol} <span>{tradeDirectionLabel(trade)}</span></h2>
          </div>
          <div className="trade-link-actions">
            <a
              className="chart-link-button"
              href={tradingViewUrl(trade.symbol)}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              Chart
            </a>
            <a
              className="chart-link-button broker-link-button"
              href={robinhoodUrl(trade.symbol)}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              RH {trade.symbol}
            </a>
          </div>
        </div>
        <div className="trade-card-statuses">
          <span className="trade-status open">Open</span>
          <strong className={currentR !== null && currentR < 0 ? "current-r negative" : "current-r"}>
            {currentR === null ? "— R" : `${currentR.toFixed(2)}R`}
          </strong>
        </div>
      </summary>
      <article className="open-trade-card">

      <section
        className={`required-action required-action-${
          primaryRequiredAction?.severity ?? "none"
        }`}
      >
        <span>Required Action</span>
        <strong>{requiredActionText(primaryRequiredAction)}</strong>
        {primaryRequiredAction && <p>{primaryRequiredAction.message}</p>}
      </section>

      <PriceActionClassification trade={trade} englishOnly />

      <div className="trade-facts cockpit-metrics">
        {horizonControl}
        <div><span>Current Underlying R</span><strong>{currentR === null ? "—" : `${currentR.toFixed(2)}R`}</strong></div>
        <div><span>Initial entry</span><strong>{displayPrice(trade.actual_entry)}</strong></div>
        <div><span>Weighted average entry</span><strong>{displayPrice(trade.position_summary.weighted_average_entry)}</strong></div>
        {trade.option_contract && (
          <div><span>Option contract</span><strong>{trade.option_contract}</strong></div>
        )}
        <EditableMetric label="Current stop" value={trade.current_stop} required onSave={async (value) => {
          setCurrentStop(value === null ? "" : formatDecimal(value));
          await update({ current_stop: value });
        }} />
        <EditableMetric label={trade.market === "options" ? "Underlying price" : "Current price"} value={trade.current_price} onSave={async (value) => {
          setCurrentPrice(value === null ? "" : formatDecimal(value));
          await update({ current_price: value });
        }} />
        <div className="price-freshness-fact"><span>Price status</span><PriceFreshness source={trade.current_price_source} updatedAt={trade.current_price_updated_at} /></div>
        {trade.market === "options" && <EditableMetric label="Option entry" value={trade.option_entry_price} required onSave={(value) => update({ option_entry_price: value })} />}
        <div className="combined-targets-metric">
          <EditableMetric
            label="Target 1"
            value={trade.target_1}
            required
            onSave={(value) => update({ target_1: value ?? trade.target_1 })}
          />
          <EditableMetric
            label="Target 2"
            value={trade.target_2}
            onSave={(value) => update({ target_2: value })}
          />
        </div>
        <div><span>Initial quantity</span><strong>{formatDecimal(trade.position_summary.initial_quantity)}</strong></div>
        <div><span>Added quantity</span><strong>{formatDecimal(trade.position_summary.added_quantity)}</strong></div>
        <div><span>Total entered</span><strong>{formatDecimal(trade.position_summary.total_entry_quantity)}</strong></div>
        <div><span>Exited quantity</span><strong>{formatDecimal(quantity.taken)}</strong></div>
        <div><span>Remaining quantity</span><strong>{formatDecimal(quantity.runner)}</strong></div>
        <div><span>Total underlying risk</span><strong>{formatDecimal(trade.position_summary.total_underlying_risk)}</strong></div>
        <div><span>Runner state</span><strong>{trade.runner_active ? "Active" : "Inactive"}</strong></div>
      </div>

      <PriceLadder
        entry={trade.actual_entry}
        currentPrice={parsedPrice}
        currentStop={activeStopForMap}
        target1={trade.target_1}
        target2={trade.target_2}
        partialExits={partialExitLevels}
        entryExecutions={trade.entry_executions}
        weightedAverageEntry={trade.position_summary.weighted_average_entry}
      />

      <details className="management-section trade-management-accordion exit-execution-section">
        <summary>Record Exit Execution</summary>
        <div className="action-row exit-runner-row">
          <div className={`exit-execution-fields ${trade.market === "options" ? "option-exit-fields" : ""}`}>
          <label className="partial-quantity-field">
            {trade.market === "options" ? "Underlying exit price" : "Exit price"}
            <input aria-label={`Exit execution price for ${trade.symbol}`} type="number" step="0.01" value={partialPrice} onChange={(event) => setPartialPrice(event.target.value)} />
          </label>
          {trade.market === "options" && <label className="partial-quantity-field">Option exit price<input aria-label={`Option exit price for ${trade.symbol}`} type="number" min="0.01" step="0.01" value={optionExitPrice} onChange={(event) => setOptionExitPrice(event.target.value)} /></label>}
          <label className="partial-quantity-field">
            Exit quantity
            <input aria-label={`Exit quantity for ${trade.symbol}`} type="number" min="0.01" max={quantity.runner ?? undefined} step="0.01" value={partialQuantity} onChange={(event) => updateExitQuantity(event.target.value)} />
          </label>
          <label className="exit-reason-field">Exit reason<select value={exitReason} onChange={(event) => setExitReason(event.target.value as ExitReason)}>
            <option value="partial_profit">Partial profit</option><option value="target_hit">Target hit</option>
            <option value="stop_hit">Stop hit</option><option value="runner_stop">Runner stop</option>
            <option value="risk_reduction">Risk reduction</option><option value="invalidated_setup">Invalidated setup</option>
            <option value="time_exit">Time exit</option><option value="manual_exit">Manual exit</option><option value="other">Other</option>
          </select></label>
          <button className="secondary-button record-exit-button" disabled={isSaving || !partialQuantityIsValid || parsedPartialPrice === null || (trade.market === "options" && parsedOptionExitPrice === null)} onClick={() => {
            if (parsedPartialQuantity !== null && parsedPartialPrice !== null) {
              setConfirmingExit(true);
            }
          }}>Record Exit</button>
          </div>
          <div className="inline-runner-controls">
            <label className="runner-stop-field">
              Runner stop
              <input
                aria-label={`Runner stop for ${trade.symbol}`}
                type="number"
                step="0.01"
                value={runnerStop}
                disabled={trade.runner_active || isSaving}
                onChange={(event) => setRunnerStop(event.target.value)}
                onBlur={() => {
                  const value = numberOrNull(runnerStop);
                  if (!trade.runner_active && value !== trade.runner_stop) void update({ runner_stop: value });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    setRunnerStop(trade.runner_stop === null ? "" : formatDecimal(trade.runner_stop));
                  }
                }}
              />
            </label>
            <button
              className="secondary-button"
              disabled={isSaving || (!trade.runner_active && quantity.runner === 0)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => update(trade.runner_active
                ? { runner_active: false }
                : { runner_stop: numberOrNull(runnerStop), runner_enabled: true, runner_active: true })}
            >{trade.runner_active ? "Mark Runner Inactive" : "Activate Runner"}</button>
          </div>
        </div>
      </details>

      <details className="management-section trade-management-accordion add-position-section">
        <summary>Add to Position</summary>
        <p className="section-helper">
          Record a local execution fact. This does not place a broker order.
        </p>
        <div className="add-position-fields">
          <label>
            {trade.market === "options" ? "Underlying add price" : "Add underlying price"}
            <input type="number" min="0.01" step="0.01" value={addPrice} onChange={(event) => setAddPrice(event.target.value)} />
          </label>
          {trade.market === "options" && <label>Option add price <small>Optional reference only</small><input type="number" min="0.01" step="0.01" value={addOptionPrice} onChange={(event) => setAddOptionPrice(event.target.value)} /></label>}
          <label>Add quantity<input type="number" min="0.01" step="0.01" value={addQuantity} onChange={(event) => setAddQuantity(event.target.value)} /></label>
          <label>Stop at add<input type="number" min="0.01" step="0.01" value={addStop} onChange={(event) => setAddStop(event.target.value)} /></label>
          <label>Add reason<select value={addReason} onChange={(event) => setAddReason(event.target.value as AddReason)}>
            <option value="breakout_confirmation">Breakout confirmation</option>
            <option value="pullback_continuation">Pullback continuation</option>
            <option value="risk_reentry">Risk re-entry</option>
            <option value="trend_continuation">Trend continuation</option>
            <option value="other">Other</option>
          </select></label>
          <label className="notes-field">Optional note<textarea rows={2} value={addNotes} onChange={(event) => setAddNotes(event.target.value)} /></label>
        </div>
        {addPreview && <dl className="add-risk-preview">
          <div><dt>Current total quantity</dt><dd>{formatDecimal(trade.position_summary.total_entry_quantity)}</dd></div>
          <div><dt>Add quantity</dt><dd>{formatDecimal(parsedAddQuantity)}</dd></div>
          <div><dt>New total quantity</dt><dd>{formatDecimal(addPreview.newTotalQuantity)}</dd></div>
          <div><dt>Current average entry</dt><dd>{displayPrice(trade.position_summary.weighted_average_entry)}</dd></div>
          <div><dt>New average entry</dt><dd>{formatDecimal(addPreview.newWeightedAverageEntry)}</dd></div>
          <div><dt>Incremental underlying risk</dt><dd>{formatDecimal(addPreview.incrementalRisk)}</dd></div>
          <div><dt>Current total underlying risk</dt><dd>{formatDecimal(trade.position_summary.total_underlying_risk)}</dd></div>
          <div><dt>New total underlying risk</dt><dd>{formatDecimal(addPreview.newTotalRisk)}</dd></div>
          <div><dt>Current remaining</dt><dd>{formatDecimal(trade.position_summary.remaining_quantity)}</dd></div>
          <div><dt>New remaining</dt><dd>{formatDecimal(addPreview.newRemainingQuantity)}</dd></div>
          <div><dt>Current Underlying R</dt><dd>{currentR === null ? "—" : `${currentR.toFixed(2)}R`}</dd></div>
        </dl>}
        {(trade.reversal_confirmation === "unconfirmed" || trade.is_unconfirmed_reversal) && <p className="form-message error-message">Do not add to an unconfirmed reversal attempt. Wait for confirmation or manage the existing position without increasing exposure.</p>}
        {trade.current_stop === null && <p className="form-message error-message">Record a current stop before adding exposure.</p>}
        {!addRiskIsValid && parsedAddPrice !== null && parsedAddStop !== null && <p className="form-message error-message">Stop at add must define positive directional risk.</p>}
        {losingAddWarning && <label className="warning-acknowledgement"><input type="checkbox" checked={losingAddAcknowledged} onChange={(event) => setLosingAddAcknowledged(event.target.checked)} />I confirm this is a planned add, I verified the structural stop, and I reviewed the new total risk.</label>}
        <button type="button" className="secondary-button" disabled={isSaving || addPreview === null || addBlocked || (losingAddWarning && !losingAddAcknowledged)} onClick={() => setConfirmingAdd(true)}>Review Add</button>
      </details>

      {confirmingAdd && addPreview && parsedAddQuantity !== null && parsedAddStop !== null && <div className="confirmation-backdrop" role="presentation"><section className="exit-confirmation add-confirmation" role="dialog" aria-modal="true" aria-labelledby={`add-confirmation-${trade.id}`}>
        <div><p className="eyebrow">Local execution record</p><h3 id={`add-confirmation-${trade.id}`}>Add to {trade.symbol}?</h3></div>
        <dl className="exit-confirmation-details">
          <div><dt>Horizon</dt><dd>{trade.trade_horizon}</dd></div>
          <div><dt>Direction</dt><dd>{addDirection}</dd></div>
          <div><dt>Current quantity</dt><dd>{formatDecimal(trade.position_summary.total_entry_quantity)}</dd></div>
          <div><dt>Add quantity</dt><dd>{formatDecimal(parsedAddQuantity)}</dd></div>
          <div><dt>New total quantity</dt><dd>{formatDecimal(addPreview.newTotalQuantity)}</dd></div>
          <div><dt>Current average entry</dt><dd>{displayPrice(trade.position_summary.weighted_average_entry)}</dd></div>
          <div><dt>New average entry</dt><dd>{formatDecimal(addPreview.newWeightedAverageEntry)}</dd></div>
          <div><dt>Stop at add</dt><dd>{formatDecimal(parsedAddStop)}</dd></div>
          <div><dt>Incremental risk</dt><dd>{formatDecimal(addPreview.incrementalRisk)}</dd></div>
          <div><dt>New total risk</dt><dd>{formatDecimal(addPreview.newTotalRisk)}</dd></div>
          <div><dt>Add reason</dt><dd>{addReason.replaceAll("_", " ")}</dd></div>
        </dl>
        {losingAddWarning && <p className="full-exit-warning">Warning acknowledged: this position is below its aggregate entry basis.</p>}
        <div className="confirmation-actions"><button type="button" className="secondary-button" onClick={() => setConfirmingAdd(false)}>Cancel</button><button type="button" className="primary-button" disabled={isSaving} onClick={() => void saveAddPosition()}>{isSaving ? "Recording…" : "Confirm Add"}</button></div>
      </section></div>}

      {addNotice && <p className="page-notice" role="status">{addNotice}</p>}
      {horizonConfirmation}

      {confirmingExit && parsedPartialQuantity !== null && parsedPartialPrice !== null && (() => {
        const remainingBefore = quantity.runner ?? 0;
        const remainingAfter = Math.max(0, Number((remainingBefore - parsedPartialQuantity).toFixed(2)));
        const isFullExit = Math.abs(parsedPartialQuantity - remainingBefore) < 0.005;
        return <div className="confirmation-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setConfirmingExit(false);
        }}><section className="exit-confirmation" role="dialog" aria-modal="true" aria-labelledby={`exit-confirmation-${trade.id}`}>
          <span className={isFullExit ? "confirmation-icon full-exit" : "confirmation-icon"} aria-hidden="true">{isFullExit ? "!" : "✓"}</span>
          <div><p className="eyebrow">{isFullExit ? "Full position exit" : "Partial position exit"}</p><h3 id={`exit-confirmation-${trade.id}`}>{isFullExit ? `Exit the entire ${trade.symbol} position?` : `Confirm partial exit for ${trade.symbol}`}</h3></div>
          <dl className="exit-confirmation-details">
            <div><dt>Exit price</dt><dd>{formatDecimal(parsedPartialPrice)}</dd></div>
            {trade.market === "options" && <div><dt>Option exit price</dt><dd>{parsedOptionExitPrice === null ? "—" : formatDecimal(parsedOptionExitPrice)}</dd></div>}
            <div><dt>Exit quantity</dt><dd>{formatDecimal(parsedPartialQuantity)}</dd></div>
            <div><dt>Reason</dt><dd>{exitReason.replaceAll("_", " ")}</dd></div>
            <div><dt>Remaining after</dt><dd>{formatDecimal(remainingAfter)}</dd></div>
          </dl>
          {isFullExit && <p className="full-exit-warning">This will close the trade and move it out of Open Trades.</p>}
          <div className="confirmation-actions"><button type="button" className="secondary-button" onClick={() => setConfirmingExit(false)}>Cancel</button><button type="button" className={isFullExit ? "danger-button" : "primary-button"} disabled={isSaving} onClick={() => void savePartialExit()}>{isSaving ? "Recording…" : isFullExit ? "Yes, exit position" : "Confirm partial exit"}</button></div>
        </section></div>;
      })()}

      {unifiedExecutionHistory.length > 0 && <details className="trade-history-section trade-management-accordion"><summary>Execution History</summary><div className="execution-preview-list">{unifiedExecutionHistory.map((event, index) => <div key={event.id}><span>#{index + 1}</span><strong>{event.action}</strong><span>{new Date(event.timestamp).toLocaleString()}</span><span>Underlying {formatDecimal(event.price)}</span>{trade.market === "options" && <span>Option {event.optionPrice === null ? "—" : formatDecimal(event.optionPrice)}</span>}<span>Qty {formatDecimal(event.quantity)}</span><span>{event.reason.replaceAll("_", " ")}</span>{event.stop !== null && <span>Stop {formatDecimal(event.stop)}</span>}<span>Remaining {formatDecimal(event.remaining)}</span></div>)}</div></details>}

      <details className="trade-history-section trade-management-accordion" id={`trade-${trade.id}-price-alerts`} open={defaultExpanded && contextFromHash(window.location.hash).get("section") === "price-alerts"}><summary>Price Alert History</summary>{priceAlerts.isLoading ? <p>Loading alert history…</p> : (priceAlerts.data?.length ?? 0) === 0 ? <p>No threshold alerts recorded</p> : <div className="price-alert-history">{priceAlerts.data?.map((event) => <div key={event.id} className={`email-status-${event.notification_status}`}><strong>{event.alert_kind.replaceAll("_", " ")}</strong><span>Threshold {formatDecimal(event.threshold_price)}</span><span>Observed {formatDecimal(event.observed_price)}</span><span>{new Date(event.triggered_at).toLocaleString()}</span><span>{event.notification_status}</span><span>{event.attempt_count} attempt{event.attempt_count === 1 ? "" : "s"}</span>{event.last_error && <small>{event.last_error}</small>}</div>)}</div>}</details>

      <RuleAlertPanel
        status={evaluation.status}
        alerts={evaluation.alerts}
        onDismiss={(alert) => void dismissOpenWarning(alert)}
      />
      {undoDismissalKey && <div className="warning-undo" role="status"><span>Warning dismissed.</span><button type="button" onClick={() => void undoOpenWarning()}>Undo</button></div>}

      <section className="management-section">
        <h3>Trade notes</h3>
        <label className="notes-field">
          Trade note
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <button className="secondary-button" disabled={isSaving} onClick={() => update({ notes: note.trim() || null })}>Add Note</button>

      </section>

      {error && <p className="form-message error-message">{error}</p>}
      <DeleteTradeButton trade={trade} onDeleted={onDeleted} />
      </article>
    </details>
  );
}

export function OpenTradePanel() {
  const queryClient = useQueryClient();
  const [horizonFilter, setHorizonFilter] = useState<HorizonFilterValue>("all");
  const [sortBy, setSortBy] = useState<TradeSort>("opened");
  const [closeNotice, setCloseNotice] = useState<Trade | null>(null);
  const loaded = useTrades(undefined, horizonForApi(horizonFilter));
  const { setTrades, isLoading, error } = loaded;
  const trades = useMemo(
    () =>
      sortActiveTrades(
        loaded.trades.filter(
          (trade) => trade.status === "planned" || trade.status === "open",
        ),
        sortBy,
      ),
    [loaded.trades, sortBy],
  );
  const tradeGroups = useMemo(() => groupTradesByMarket(trades), [trades]);
  const selectedTradeId = positiveIntegerContext(contextFromHash(window.location.hash), "trade_id");
  const hasSelectedTrade = selectedTradeId !== null && trades.some((trade) => trade.id === selectedTradeId);

  useEffect(() => {
    if (!hasSelectedTrade) return;
    window.setTimeout(() => document.getElementById(`trade-${selectedTradeId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }, [hasSelectedTrade, selectedTradeId]);

  function replaceTrade(updatedTrade: Trade) {
    setTrades((current) =>
      updatedTrade.status === "closed"
        ? current.filter((trade) => trade.id !== updatedTrade.id)
        : current.map((trade) =>
            trade.id === updatedTrade.id ? updatedTrade : trade,
          ),
    );
    void queryClient.invalidateQueries({ queryKey: ["attention"] });
  }

  return (
    <section className="open-trades-page">
      <div className="open-trades-heading">
        <div>
          <p className="eyebrow">In-trade</p>
          <h2>Manage live risk.</h2>
        </div>
        <div className="heading-controls">
          <HorizonFilter value={horizonFilter} onChange={setHorizonFilter} />
          <label className="horizon-filter trade-sort-control">
            Rank trades
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as TradeSort)}
            >
              <option value="opened">Open time (newest)</option>
              <option value="symbol">Name (A–Z)</option>
              <option value="current_r">Current R (high–low)</option>
            </select>
          </label>
          <span>{trades.length} active plan{trades.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {closeNotice && <div className="page-success-notice" role="status">
        <strong>{closeNotice.symbol} trade #{closeNotice.id} closed automatically.</strong>
        <span>Final underlying R: {closeNotice.final_r === null ? "—" : `${closeNotice.final_r.toFixed(2)}R`} · Exit reason: {closeNotice.exit_reason?.replaceAll("_", " ") ?? "—"}</span>
        <div className="page-success-actions">
          <button type="button" onClick={() => { window.location.hash = hashWithContext("post-trade-review", { trade_id: closeNotice.id }); }}>Review This Trade</button>
          <button type="button" onClick={() => setCloseNotice(null)}>Dismiss</button>
        </div>
      </div>}

      {isLoading && <p className="empty-state">Loading active trades…</p>}
      {error && <p className="form-message error-message">{error}</p>}
      {selectedTradeId !== null && !isLoading && !hasSelectedTrade && <p className="form-message error-message">The requested active trade was not found.</p>}
      {!isLoading && !error && trades.length === 0 && (
        <div className="empty-state">
          <strong>No planned or open trades.</strong>
          <p>Create a trade plan first, then return here to manage it.</p>
        </div>
      )}
      <div className="open-trade-list">
        {tradeGroups.map((group) => (
          <section className="market-trade-group" key={group.key}>
            <div className="market-group-heading">
              <h3>{group.label}</h3>
            </div>
            <div className="market-group-list">
              {group.trades.map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  onUpdated={replaceTrade}
                  onDeleted={(tradeId) =>
                    setTrades((current) => current.filter((item) => item.id !== tradeId))
                  }
                  onAutoClosed={setCloseNotice}
                  defaultExpanded={trade.id === selectedTradeId}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
