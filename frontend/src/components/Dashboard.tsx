import { useCallback, useEffect, useState } from "react";

import { APIError, getHealth, refreshOpenPrices } from "../api";
import { useDailySummaryQuery } from "../hooks/queries";
import type { ConnectionState, Trade } from "../types";
import { groupTradesByMarket } from "../utils/tradeGrouping";
import { calculateCurrentR, calculatePositionBreakdown, resolvedUnderlyingDirection } from "../utils/tradeCalculations";
import { formatDecimal } from "../utils/decimal";
import {
  HorizonFilter,
  type HorizonFilterValue,
  horizonForApi,
} from "./HorizonFilter";
import { IntradayReadinessPanel } from "./IntradayReadinessPanel";
import { SummaryCards } from "./SummaryCards";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";
import { StatusBadge } from "./ui/StatusBadge";

const connectionCopy: Record<ConnectionState, string> = {
  checking: "Checking backend…",
  connected: "Backend connected",
  unavailable: "Backend unavailable",
};

function requestErrorMessage(error: unknown): string {
  return error instanceof APIError
    ? `${error.code}: ${error.message}`
    : "Could not load today's discipline summary.";
}

export function Dashboard() {
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [summaryHorizon, setSummaryHorizon] = useState<HorizonFilterValue>("all");
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [quoteError, setQuoteError] = useState("");
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const summaryQuery = useDailySummaryQuery(undefined, horizonForApi(summaryHorizon));
  const summary = summaryQuery.data ?? null;
  const openTradeGroups = groupTradesByMarket(openTrades);
  const summaryError = summaryQuery.error
    ? requestErrorMessage(summaryQuery.error)
    : "";

  const refreshQuotes = useCallback(async () => {
    setIsRefreshingQuotes(true);
    setQuoteError("");
    try {
      const result = await refreshOpenPrices();
      setOpenTrades(result.trades);
      if (result.source === "manual") {
        setQuoteError("Finnhub is not configured; showing the latest manually recorded prices.");
      } else if (result.errors.length > 0) {
        setQuoteError(result.errors.map((item) => `${item.symbol}: ${item.message}`).join(" · "));
      }
    } catch (error) {
      setQuoteError(requestErrorMessage(error));
    } finally {
      setIsRefreshingQuotes(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    setConnection("checking");
    setIsLoadingSummary(true);

    try {
      const health = await getHealth();
      setConnection(health.status === "ok" ? "connected" : "unavailable");
    } catch {
      setConnection("unavailable");
      setIsLoadingSummary(false);
      return;
    }

    try {
      await refreshQuotes();
    } catch (error) {
      setQuoteError(requestErrorMessage(error));
    } finally {
      setIsLoadingSummary(false);
    }
  }, [refreshQuotes]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  return (
    <section className="dashboard" aria-label="Dashboard">

      <Panel className="dashboard-summary" aria-labelledby="today-summary-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Daily discipline</p>
            <h3 id="today-summary-title">Today at a glance</h3>
          </div>
          {summary?.most_frequent_mistakes[0] && (
            <span className="top-mistake-badge">
              Top issue: {summary.most_frequent_mistakes[0].tag.replaceAll("_", " ")}
            </span>
          )}
          <HorizonFilter
            value={summaryHorizon}
            onChange={setSummaryHorizon}
            label="Summary horizon"
          />
        </div>

        {(isLoadingSummary || summaryQuery.isLoading) && (
          <p className="empty-state">Loading today&apos;s summary…</p>
        )}
        {summaryError && <p className="form-message error-message">{summaryError}</p>}
        {!isLoadingSummary && !summaryQuery.isLoading && !summaryError && summary?.total_trades === 0 && (
          <div className="empty-state">
            <strong>No trades recorded today.</strong>
            <p>Create a plan when the next valid setup appears.</p>
          </div>
        )}
        {!isLoadingSummary && summary && summary.total_trades > 0 && (
          <SummaryCards summary={summary} />
        )}
      </Panel>

      <details className="unrealized-positions">
        <summary>
          <div className="unrealized-heading-copy"><span className="unrealized-count">{openTrades.length}</span><div><p className="eyebrow">Active positions</p><strong>Unrealized performance</strong><small>Current return and remaining quantity</small></div></div>
          <Button
            variant="secondary"
            disabled={isRefreshingQuotes}
            onClick={(event) => {
              event.preventDefault();
              void refreshQuotes();
            }}
          >
            {isRefreshingQuotes ? "Refreshing…" : "Refresh prices"}
          </Button>
        </summary>
        {quoteError && <p className="unrealized-data-note"><span aria-hidden="true">i</span>{quoteError}</p>}
        {openTrades.length === 0 ? (
          <p className="rule-empty">No open positions.</p>
        ) : (
          <div className="unrealized-list">
            {openTradeGroups.map((group) => (
              <section className="market-trade-group compact" key={group.key}>
                <div className="market-group-heading">
                  <h3>{group.label}</h3><span>{group.trades.length} position{group.trades.length === 1 ? "" : "s"}</span>
                </div>
                <div className="market-group-list">
                  {group.trades.map((trade) => {
                    const entry = trade.actual_entry ?? trade.planned_entry;
                    const priceDirection = trade.market === "options"
                      ? resolvedUnderlyingDirection(trade.direction, trade.option_type, entry, trade.stop_loss)
                      : trade.direction;
                    const currentR = trade.current_price === null
                      ? null
                      : calculateCurrentR(priceDirection, entry, trade.stop_loss, trade.current_price);
                    const priceReturn = trade.current_price === null || entry === 0
                      ? null
                      : ((priceDirection === "long" ? trade.current_price - entry : entry - trade.current_price) / entry) * 100;
                    const remaining = calculatePositionBreakdown(
                      trade.position_size,
                      trade.partial_exit_quantity,
                    ).runner;
                    return (
                      <article className="unrealized-row" key={trade.id}>
                        <div className="unrealized-symbol"><strong>{trade.symbol}</strong><span>{trade.market === "options" ? (trade.direction === "long" ? "Buy" : "Sell") : trade.direction}</span>{trade.option_contract && <small>{trade.option_contract}</small>}</div>
                        <div><span>Remaining</span><strong>{remaining === null ? "—" : remaining.toFixed(2)}</strong></div>
                        <div><span>{trade.market === "options" ? "Underlying" : "Current price"}</span><strong>{trade.current_price === null ? "—" : formatDecimal(trade.current_price)}</strong></div>
                        <div className={currentR !== null && currentR < 0 ? "metric-negative" : "metric-positive"}><span>Current R</span><strong>{currentR === null || !Number.isFinite(currentR) ? "—" : `${currentR >= 0 ? "+" : ""}${currentR.toFixed(2)}R`}</strong></div>
                        <div className={priceReturn !== null && priceReturn < 0 ? "metric-negative" : "metric-positive"}><span>Price return</span><strong>{priceReturn === null ? "—" : `${priceReturn >= 0 ? "+" : ""}${priceReturn.toFixed(2)}%`}</strong></div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </details>

      <div className="dashboard-grid">
        <article className="status-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">System status</p>
              <h3>Backend connection</h3>
            </div>
            <StatusBadge variant={connection} showDot>
              {connectionCopy[connection]}
            </StatusBadge>
          </div>
          <p className="muted">
            Summary data comes from the FastAPI <code>/summary/daily</code> endpoint.
          </p>
          {connection === "unavailable" && (
            <Button
              variant="secondary"
              onClick={() => {
                void refreshDashboard();
                void summaryQuery.refetch();
              }}
            >
              Check again
            </Button>
          )}
        </article>

        <article className="principle-card">
          <p className="eyebrow">Daily principle</p>
          <blockquote>
            “A good trade can lose. A bad trade can win. Grade the decision.”
          </blockquote>
        </article>
      </div>

      <IntradayReadinessPanel />
    </section>
  );
}
