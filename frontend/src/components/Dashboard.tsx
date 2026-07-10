import { useCallback, useEffect, useState } from "react";

import { APIError, getHealth, refreshOpenPrices } from "../api";
import { useDailySummaryQuery } from "../hooks/queries";
import type { ConnectionState, Trade } from "../types";
import { groupTradesByMarket } from "../utils/tradeGrouping";
import { calculateCurrentR } from "../utils/tradeCalculations";
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
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="hero-card">
        <p className="eyebrow">Today&apos;s operating state</p>
        <h2 id="dashboard-title">Discipline status and active risk.</h2>
        <p>
          Check readiness, open risk, blocker pressure, and review quality before
          adding another trade.
        </p>
      </div>

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
          <span>
            <strong>{openTrades.length} unrealized position{openTrades.length === 1 ? "" : "s"}</strong>
            <small>Open to inspect current return and remaining quantity</small>
          </span>
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
        {quoteError && <p className="form-message error-message">{quoteError}</p>}
        {openTrades.length === 0 ? (
          <p className="rule-empty">No open positions.</p>
        ) : (
          <div className="unrealized-list">
            {openTradeGroups.map((group) => (
              <section className="market-trade-group compact" key={group.key}>
                <div className="market-group-heading">
                  <h3>{group.label}</h3>
                </div>
                <div className="market-group-list">
                  {group.trades.map((trade) => {
                    const entry = trade.actual_entry ?? trade.planned_entry;
                    const currentR = trade.current_price === null
                      ? null
                      : calculateCurrentR(trade.direction, entry, trade.stop_loss, trade.current_price);
                    const priceReturn = trade.current_price === null || entry === 0
                      ? null
                      : ((trade.direction === "long" ? trade.current_price - entry : entry - trade.current_price) / entry) * 100;
                    const remaining = trade.position_size === null
                      ? null
                      : Math.max(trade.position_size - trade.partial_exit_quantity, 0);
                    return (
                      <article className="unrealized-row" key={trade.id}>
                        <div><strong>{trade.symbol}</strong><span>{trade.direction}</span></div>
                        <div><span>Remaining</span><strong>{remaining ?? "—"}</strong></div>
                        <div><span>Current price</span><strong>{trade.current_price ?? "Not available"}</strong></div>
                        <div><span>Current R</span><strong>{currentR === null || !Number.isFinite(currentR) ? "—" : `${currentR >= 0 ? "+" : ""}${currentR.toFixed(2)}R`}</strong></div>
                        <div><span>Price return</span><strong>{priceReturn === null ? "—" : `${priceReturn >= 0 ? "+" : ""}${priceReturn.toFixed(2)}%`}</strong></div>
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
