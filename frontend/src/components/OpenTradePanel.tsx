import { useEffect, useMemo, useState } from "react";

import {
  APIError,
  evaluateRules,
  openTrade,
  patchTrade,
  recordPartialExit,
} from "../api";
import { useTrades } from "../hooks/useTrades";
import type {
  RuleAlert,
  RuleEvaluationResult,
  Trade,
  TradePatchPayload,
  ExitReason,
} from "../types";
import { formatDecimal, parseDecimalInput } from "../utils/decimal";
import { groupTradesByMarket } from "../utils/tradeGrouping";
import {
  calculateCurrentR,
  calculatePositionBreakdown,
  resolvedUnderlyingDirection,
} from "../utils/tradeCalculations";
import { PriceLadder } from "./PriceLadder";
import { PriceFreshness } from "./PriceFreshness";
import { RuleAlertPanel } from "./RuleAlertPanel";
import { DeleteTradeButton } from "./DeleteTradeButton";
import {
  HorizonFilter,
  type HorizonFilterValue,
  horizonForApi,
} from "./HorizonFilter";

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

function errorMessage(error: unknown): string {
  return error instanceof APIError
    ? `${error.code}: ${error.message}`
    : "The trade update failed. Confirm that the backend is running.";
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

  const parsedEntry = numberOrNull(actualEntry);
  const parsedPlannedOptionEntry = numberOrNull(plannedOptionEntry);
  const parsedPrice = numberOrNull(currentPrice);
  const currentR = useMemo(() => {
    if (parsedEntry === null || parsedPrice === null) return null;
    const value = calculateCurrentR(
      trade.market === "options" ? resolvedUnderlyingDirection(trade.direction, trade.option_type, parsedEntry, trade.stop_loss) : trade.direction,
      parsedEntry,
      trade.stop_loss,
      parsedPrice,
    );
    return Number.isFinite(value) ? value : null;
  }, [parsedEntry, parsedPrice, trade.direction, trade.market, trade.option_type, trade.stop_loss]);
  const quantity = calculatePositionBreakdown(
    trade.position_size,
    trade.partial_exit_quantity,
  );
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
    trade.position_size !== null &&
    quantity.runner !== null &&
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
    return runAction(() => patchTrade(trade.id, updates));
  }

  function updateExitQuantity(value: string) {
    const requested = numberOrNull(value);
    if (requested === null || trade.position_size === null) {
      setPartialQuantity(value);
      return;
    }
    const remaining = quantity.runner ?? 0;
    setPartialQuantity(requested > remaining ? formatDecimal(remaining) : value);
  }

  async function savePartialExit() {
    if (parsedPartialQuantity === null || parsedPartialPrice === null) return;
    setIsSaving(true);
    setError("");
    try {
      const updated = await recordPartialExit(
        trade.id, parsedPartialPrice, parsedPartialQuantity, exitReason,
        trade.market === "options" ? parsedOptionExitPrice : null,
      );
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
      <details className="trade-accordion planned-trade-card" open={defaultExpanded}>
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
        <div className="trade-facts compact-facts cockpit-metrics">
          <div><span>Horizon</span><strong>{trade.trade_horizon}</strong></div>
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
            onClick={() => runAction(() => openTrade(trade.id, parsedEntry, parsedPlannedOptionEntry))}
          >
            {isSaving ? "Opening…" : "Mark Entry Filled"}
          </button>
          {trade.position_size === null && <small className="form-message error-message">Set position size before marking the entry filled.</small>}
        </div>
        {error && <p className="form-message error-message">{error}</p>}
        <DeleteTradeButton trade={trade} onDeleted={onDeleted} />
        </article>
      </details>
    );
  }

  return (
    <details className="trade-accordion" open={defaultExpanded}>
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

      <div className="trade-facts cockpit-metrics">
        <div><span>Horizon</span><strong>{trade.trade_horizon}</strong></div>
        <div><span>Current R</span><strong>{currentR === null ? "—" : `${currentR.toFixed(2)}R`}</strong></div>
        <div><span>Actual entry</span><strong>{displayPrice(trade.actual_entry)}</strong></div>
        {trade.option_contract && (
          <div><span>Option contract</span><strong>{trade.option_contract}</strong></div>
        )}
        <div><span>Initial stop</span><strong>{formatDecimal(trade.stop_loss)}</strong></div>
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
        <EditableMetric
          label="Position size"
          value={trade.position_size}
          onSave={(value) => update({ position_size: value })}
        />
        <div><span>Partial quantity</span><strong>{formatDecimal(quantity.taken)}</strong></div>
        <div><span>Runner remaining</span><strong>{quantity.runner === null ? "—" : formatDecimal(quantity.runner)}</strong></div>
        <div><span>Runner state</span><strong>{trade.runner_active ? "Active" : "Inactive"}</strong></div>
      </div>

      <PriceLadder
        entry={trade.actual_entry}
        currentPrice={parsedPrice}
        currentStop={activeStopForMap}
        target1={trade.target_1}
        target2={trade.target_2}
        partialExits={partialExitLevels}
      />

      <section className="management-section">
        <h3>Record Exit Execution</h3>
        <div className="action-row">
          <label className="partial-quantity-field">
            {trade.market === "options" ? "Underlying exit price" : "Exit price"}
            <input aria-label={`Exit execution price for ${trade.symbol}`} type="number" step="0.01" value={partialPrice} onChange={(event) => setPartialPrice(event.target.value)} />
          </label>
          {trade.market === "options" && <label className="partial-quantity-field">Option exit price<input aria-label={`Option exit price for ${trade.symbol}`} type="number" min="0.01" step="0.01" value={optionExitPrice} onChange={(event) => setOptionExitPrice(event.target.value)} /></label>}
          <label className="partial-quantity-field">
            Exit quantity
            <input aria-label={`Exit quantity for ${trade.symbol}`} type="number" min="0.01" max={quantity.runner ?? undefined} step="0.01" value={partialQuantity} onChange={(event) => updateExitQuantity(event.target.value)} />
          </label>
          <label>Exit reason<select value={exitReason} onChange={(event) => setExitReason(event.target.value as ExitReason)}>
            <option value="partial_profit">Partial profit</option><option value="target_hit">Target hit</option>
            <option value="stop_hit">Stop hit</option><option value="runner_stop">Runner stop</option>
            <option value="risk_reduction">Risk reduction</option><option value="invalidated_setup">Invalidated setup</option>
            <option value="time_exit">Time exit</option><option value="manual_exit">Manual exit</option><option value="other">Other</option>
          </select></label>
          <button className="secondary-button" disabled={isSaving || !partialQuantityIsValid || parsedPartialPrice === null || (trade.market === "options" && parsedOptionExitPrice === null)} onClick={() => {
            if (parsedPartialQuantity !== null && parsedPartialPrice !== null) {
              setConfirmingExit(true);
            }
          }}>Record Exit</button>
        </div>
      </section>

      {confirmingExit && parsedPartialQuantity !== null && parsedPartialPrice !== null && trade.position_size !== null && (() => {
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

      <section className="management-section">
        <h3>Runner management</h3>
        <div className="runner-control-row">
          <label>
            Runner stop
            <input aria-label={`Runner stop for ${trade.symbol}`} type="number" step="any" value={runnerStop} onChange={(event) => setRunnerStop(event.target.value)} />
          </label>
          <button className="secondary-button" disabled={isSaving || numberOrNull(runnerStop) === null} onClick={() => update({ runner_stop: numberOrNull(runnerStop) })}>Save Runner Stop</button>
          <button className="secondary-button" disabled={isSaving || trade.runner_active || quantity.runner === 0} onClick={() => update({ runner_enabled: true, runner_active: true })}>Runner Active</button>
          <button className="secondary-button" disabled={isSaving || !trade.runner_active} onClick={() => update({ runner_active: false })}>Runner Closed</button>
        </div>
      </section>

      <RuleAlertPanel
        status={evaluation.status}
        alerts={evaluation.alerts}
      />

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
  const [horizonFilter, setHorizonFilter] = useState<HorizonFilterValue>("all");
  const [closeNotice, setCloseNotice] = useState<Trade | null>(null);
  const loaded = useTrades(undefined, horizonForApi(horizonFilter));
  const { setTrades, isLoading, error } = loaded;
  const trades = useMemo(
    () =>
      loaded.trades
        .filter((trade) => trade.status === "planned" || trade.status === "open")
        .sort((left, right) => {
          const statusDifference =
            Number(right.status === "open") - Number(left.status === "open");
          return statusDifference || right.id - left.id;
        }),
    [loaded.trades],
  );
  const tradeGroups = useMemo(() => groupTradesByMarket(trades), [trades]);

  function replaceTrade(updatedTrade: Trade) {
    setTrades((current) =>
      updatedTrade.status === "closed"
        ? current.filter((trade) => trade.id !== updatedTrade.id)
        : current.map((trade) =>
            trade.id === updatedTrade.id ? updatedTrade : trade,
          ),
    );
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
          <span>{trades.length} active plan{trades.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {closeNotice && <div className="page-success-notice" role="status">
        <strong>{closeNotice.symbol} trade #{closeNotice.id} closed automatically.</strong>
        <span>Total exited quantity reached the full position size{closeNotice.final_r === null ? "." : ` at ${closeNotice.final_r.toFixed(2)}R.`}</span>
        <button type="button" onClick={() => setCloseNotice(null)}>Dismiss</button>
      </div>}

      {isLoading && <p className="empty-state">Loading active trades…</p>}
      {error && <p className="form-message error-message">{error}</p>}
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
                  defaultExpanded={false}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
