import { useEffect, useMemo, useState } from "react";

import {
  APIError,
  closeTrade,
  evaluateRules,
  getQuote,
  openTrade,
  patchTrade,
  recordPartialExit,
} from "../api";
import { useTrades } from "../hooks/useTrades";
import type {
  RuleAlert,
  RuleEvaluationResult,
  QuoteResult,
  Trade,
  TradePatchPayload,
} from "../types";
import { formatDecimal, parseDecimalInput } from "../utils/decimal";
import {
  calculateCurrentR,
  calculatePositionBreakdown,
} from "../utils/tradeCalculations";
import { PriceLadder } from "./PriceLadder";
import { RuleAlertPanel } from "./RuleAlertPanel";
import { DeleteTradeButton } from "./DeleteTradeButton";

interface TradeCardProps {
  trade: Trade;
  onUpdated: (trade: Trade) => void;
  defaultExpanded: boolean;
  onDeleted: (tradeId: number) => void;
}

function numberOrNull(value: string): number | null {
  return parseDecimalInput(value);
}

function displayPrice(value: number | null): string {
  return value === null ? "—" : value.toString();
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

function TradeCard({ trade, onUpdated, defaultExpanded, onDeleted }: TradeCardProps) {
  const [actualEntry, setActualEntry] = useState(
    trade.actual_entry?.toString() ?? trade.planned_entry.toString(),
  );
  const [currentPrice, setCurrentPrice] = useState(
    trade.current_price?.toString() ?? "",
  );
  const [currentStop, setCurrentStop] = useState(
    trade.current_stop?.toString() ?? trade.stop_loss.toString(),
  );
  const [runnerStop, setRunnerStop] = useState(
    trade.runner_stop?.toString() ?? "",
  );
  const [initialQuantity, setInitialQuantity] = useState(
    trade.position_size?.toString() ?? "",
  );
  const [partialQuantity, setPartialQuantity] = useState("");
  const [partialPrice, setPartialPrice] = useState("");
  const [note, setNote] = useState(trade.notes ?? "");
  const [exitPrice, setExitPrice] = useState("");
  const [exitReason, setExitReason] = useState("manual_exit");
  const [evaluation, setEvaluation] = useState<RuleEvaluationResult>({
    status: "allowed",
    alerts: [],
  });
  const [underlyingQuote, setUnderlyingQuote] = useState<QuoteResult | null>(null);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const parsedEntry = numberOrNull(actualEntry);
  const parsedPrice = numberOrNull(currentPrice);
  const currentR = useMemo(() => {
    if (parsedEntry === null || parsedPrice === null) return null;
    const value = calculateCurrentR(
      trade.direction,
      parsedEntry,
      trade.stop_loss,
      parsedPrice,
    );
    return Number.isFinite(value) ? value : null;
  }, [parsedEntry, parsedPrice, trade.direction, trade.stop_loss]);
  const quantity = calculatePositionBreakdown(
    trade.position_size,
    trade.partial_exit_quantity,
  );
  const parsedPartialQuantity = numberOrNull(partialQuantity);
  const parsedPartialPrice = numberOrNull(partialPrice);
  const parsedInitialQuantity = numberOrNull(initialQuantity);
  const partialQuantityIsValid =
    parsedPartialQuantity !== null &&
    parsedPartialQuantity >= 0 &&
    (trade.position_size === null ||
      parsedPartialQuantity < trade.position_size - trade.partial_exit_quantity);
  const primaryRequiredAction = requiredAction(evaluation.alerts);

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

  async function savePartialExit() {
    if (parsedPartialQuantity === null || parsedPartialPrice === null) return;
    setIsSaving(true);
    setError("");
    try {
      onUpdated(
        await recordPartialExit(trade.id, parsedPartialPrice, parsedPartialQuantity),
      );
      setPartialPrice("");
      setPartialQuantity("");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function fetchUnderlyingReference() {
    setIsFetchingQuote(true);
    setQuoteMessage("");
    setUnderlyingQuote(null);
    try {
      const result = await getQuote(trade.symbol);
      setUnderlyingQuote(result);
      if (result.price === null) {
        setQuoteMessage(result.message ?? "Underlying price could not be fetched.");
        return;
      }
      const formattedPrice = formatDecimal(result.price);
      setCurrentPrice(formattedPrice);
      onUpdated(await patchTrade(trade.id, { current_price: result.price }));
      setQuoteMessage(
        `${trade.symbol} underlying price fetched and saved. This is not option premium.`,
      );
    } catch (requestError) {
      setQuoteMessage(
        requestError instanceof APIError
          ? `${requestError.code}: ${requestError.message}`
          : "Underlying price could not be fetched.",
      );
    } finally {
      setIsFetchingQuote(false);
    }
  }

  if (trade.status === "planned") {
    return (
      <details className="trade-accordion planned-trade-card" open={defaultExpanded}>
        <summary className="trade-summary">
          <div>
            <p className="eyebrow">Planned trade #{trade.id}</p>
            <h2>{trade.symbol} <span>{trade.direction}</span></h2>
          </div>
          <span className="trade-status planned">Planned</span>
        </summary>
        <article className="open-trade-card">
        <div className="trade-facts compact-facts">
          <div><span>Planned entry</span><strong>{trade.planned_entry}</strong></div>
          <div><span>Initial stop</span><strong>{trade.stop_loss}</strong></div>
          <div><span>Target 1</span><strong>{trade.target_1}</strong></div>
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
          <button
            className="primary-button"
            disabled={isSaving || parsedEntry === null}
            onClick={() => runAction(() => openTrade(trade.id, parsedEntry))}
          >
            {isSaving ? "Opening…" : "Mark Entry Filled"}
          </button>
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
        <div>
          <p className="eyebrow">Open trade #{trade.id}</p>
          <h2>{trade.symbol} <span>{trade.direction}</span></h2>
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

      <div className="trade-facts">
        <div><span>Actual entry</span><strong>{displayPrice(trade.actual_entry)}</strong></div>
        {trade.option_contract && (
          <div><span>Option contract</span><strong>{trade.option_contract}</strong></div>
        )}
        <div><span>Initial stop</span><strong>{trade.stop_loss}</strong></div>
        <div><span>Current stop</span><strong>{displayPrice(trade.current_stop)}</strong></div>
        <div><span>Target 1</span><strong>{trade.target_1}</strong></div>
        <div><span>Target 2</span><strong>{displayPrice(trade.target_2)}</strong></div>
        {trade.market === "options" && (
          <div><span>Underlying price</span><strong>{displayPrice(trade.current_price)}</strong></div>
        )}
        <div><span>Initial quantity</span><strong>{quantity.initial ?? "—"}</strong></div>
        <div><span>Taken profit</span><strong>{quantity.taken}</strong></div>
        <div><span>Runner remaining</span><strong>{quantity.runner ?? "—"}</strong></div>
      </div>

      <section className="management-section">
        <h3>Position details</h3>
        <div className="management-grid runner-grid">
          <label>
            Initial quantity
            <input
              aria-label={`Initial quantity for ${trade.symbol}`}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={initialQuantity}
              onChange={(event) => setInitialQuantity(event.target.value)}
            />
          </label>
          <button
            className="secondary-button"
            disabled={isSaving || parsedInitialQuantity === null}
            onClick={() => update({ position_size: parsedInitialQuantity })}
          >
            Save Initial Quantity
          </button>
        </div>

        {trade.market === "options" && (
          <div className="option-underlying-reference">
            <button
              className="secondary-button"
              type="button"
              disabled={isFetchingQuote}
              onClick={() => void fetchUnderlyingReference()}
            >
              {isFetchingQuote ? "Fetching..." : `Fetch ${trade.symbol} price`}
            </button>
            {underlyingQuote?.price !== null && underlyingQuote?.price !== undefined && (
              <div>
                <span>Underlying price</span>
                <strong>{formatDecimal(underlyingQuote.price)}</strong>
                <small>
                  {underlyingQuote.source} ·{" "}
                  {new Date(underlyingQuote.fetched_at).toLocaleString()}
                </small>
              </div>
            )}
            {quoteMessage && <p>{quoteMessage}</p>}
          </div>
        )}
      </section>

      <PriceLadder
        entry={trade.actual_entry}
        currentPrice={parsedPrice}
        currentStop={numberOrNull(currentStop)}
        target1={trade.target_1}
        target2={trade.target_2}
      />

      <section className="management-section">
        <h3>Price and stop management</h3>
        <div className="management-grid">
          <label>
            {trade.market === "options" ? "Underlying price" : "Current price"}
            <input aria-label={`${trade.market === "options" ? "Underlying price" : "Current price"} for ${trade.symbol}`} type="number" step="any" value={currentPrice} onChange={(event) => setCurrentPrice(event.target.value)} />
          </label>
          <button className="secondary-button" disabled={isSaving || parsedPrice === null} onClick={() => update({ current_price: parsedPrice })}>
            {trade.market === "options" ? "Save Underlying Price" : "Update Price"}
          </button>
          <label>
            Structure stop
            <input aria-label={`Structure stop for ${trade.symbol}`} type="number" step="any" value={currentStop} onChange={(event) => setCurrentStop(event.target.value)} />
          </label>
          <button className="secondary-button" disabled={isSaving || numberOrNull(currentStop) === null} onClick={() => update({ current_stop: numberOrNull(currentStop) })}>Move Stop by Structure</button>
        </div>
        <div className="action-row">
          <button className="secondary-button" disabled={isSaving || trade.actual_entry === null} onClick={() => {
            if (trade.actual_entry !== null) {
              setCurrentStop(trade.actual_entry.toString());
              void update({ current_stop: trade.actual_entry });
            }
          }}>Move Stop to Breakeven</button>
          <label className="partial-quantity-field">
            Partial exit price
            <input aria-label={`Partial exit price for ${trade.symbol}`} type="number" step="any" value={partialPrice} onChange={(event) => setPartialPrice(event.target.value)} />
          </label>
          <label className="partial-quantity-field">
            Quantity taken
            <input aria-label={`Partial quantity for ${trade.symbol}`} type="number" min="0" step="any" value={partialQuantity} onChange={(event) => setPartialQuantity(event.target.value)} />
          </label>
          <button className="secondary-button" disabled={isSaving || !partialQuantityIsValid || parsedPartialPrice === null} onClick={() => {
            if (parsedPartialQuantity !== null && parsedPartialPrice !== null) {
              void savePartialExit();
            }
          }}>Record Partial Profit</button>
        </div>
      </section>

      <section className="management-section">
        <h3>Runner management</h3>
        <div className="management-grid runner-grid">
          <label>
            Runner stop
            <input aria-label={`Runner stop for ${trade.symbol}`} type="number" step="any" value={runnerStop} onChange={(event) => setRunnerStop(event.target.value)} />
          </label>
          <button className="secondary-button" disabled={isSaving || numberOrNull(runnerStop) === null} onClick={() => update({ runner_stop: numberOrNull(runnerStop) })}>Save Runner Stop</button>
        </div>
        <div className="action-row">
          <button className="secondary-button" disabled={isSaving || trade.runner_active || quantity.runner === 0} onClick={() => update({ runner_enabled: true, runner_active: true })}>Runner Active</button>
          <button className="secondary-button" disabled={isSaving || !trade.runner_active} onClick={() => update({ runner_active: false })}>Runner Closed</button>
        </div>
      </section>

      <RuleAlertPanel
        status={evaluation.status}
        alerts={evaluation.alerts}
      />

      <section className="management-section">
        <h3>Notes and exit</h3>
        <label className="notes-field">
          Trade note
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <button className="secondary-button" disabled={isSaving} onClick={() => update({ notes: note.trim() || null })}>Add Note</button>

        <div className="exit-row">
          <label>
            Exit price
            <input aria-label={`Exit price for ${trade.symbol}`} type="number" step="any" value={exitPrice} onChange={(event) => setExitPrice(event.target.value)} />
          </label>
          <label>
            Exit reason
            <select value={exitReason} onChange={(event) => setExitReason(event.target.value)}>
              <option value="target_hit">Target hit</option>
              <option value="stop_hit">Stop hit</option>
              <option value="manual_exit">Manual exit</option>
              <option value="runner_stop">Runner stop</option>
              <option value="invalidated_setup">Invalidated setup</option>
              <option value="time_exit">Time exit</option>
            </select>
          </label>
          <button className="danger-button" disabled={isSaving || numberOrNull(exitPrice) === null} onClick={() => {
            const price = numberOrNull(exitPrice);
            if (price !== null) {
              void runAction(() => closeTrade(trade.id, { exit_price: price, exit_reason: exitReason }));
            }
          }}>Exit Trade</button>
        </div>
      </section>

      {error && <p className="form-message error-message">{error}</p>}
      <DeleteTradeButton trade={trade} onDeleted={onDeleted} />
      </article>
    </details>
  );
}

export function OpenTradePanel() {
  const loaded = useTrades();
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
          <h2>Manage risk while the trade is live.</h2>
        </div>
        <span>{trades.length} active plan{trades.length === 1 ? "" : "s"}</span>
      </div>

      {isLoading && <p className="empty-state">Loading active trades…</p>}
      {error && <p className="form-message error-message">{error}</p>}
      {!isLoading && !error && trades.length === 0 && (
        <div className="empty-state">
          <strong>No planned or open trades.</strong>
          <p>Create a trade plan first, then return here to manage it.</p>
        </div>
      )}
      <div className="open-trade-list">
        {trades.map((trade, index) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            onUpdated={replaceTrade}
            onDeleted={(tradeId) =>
              setTrades((current) => current.filter((item) => item.id !== tradeId))
            }
            defaultExpanded={index === 0}
          />
        ))}
      </div>
    </section>
  );
}
