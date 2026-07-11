import { useCallback, useEffect, useState } from "react";

import { APIError, getHealth, refreshOpenPrices } from "../api";
import { useDailySummaryQuery, useNotificationStatusQuery, useTestEmailMutation } from "../hooks/queries";
import { contextFromHash } from "../utils/navigation";
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
import { PriceFreshness } from "./PriceFreshness";

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
  const notificationQuery = useNotificationStatusQuery();
  const testEmail = useTestEmailMutation();
  const summary = summaryQuery.data ?? null;
  const openTradeGroups = groupTradesByMarket(openTrades);
  const summaryError = summaryQuery.error
    ? requestErrorMessage(summaryQuery.error)
    : "";
  const notifications = notificationQuery.data;
  const alertsReliable = connection === "connected" && Boolean(
    notifications?.monitor_running && notifications.email_enabled &&
    notifications.recipient_configured && notifications.smtp_configured &&
    !notifications.last_monitor_error && notifications.latest_email_status !== "failed",
  );
  const monitorLabel = !notifications?.monitor_configured ? "Disabled" : !notifications.monitor_running ? "Misconfigured" : notifications.last_monitor_error ? "Error" : "Running";
  const emailLabel = !notifications?.email_enabled ? "Disabled" : !notifications.recipient_configured || !notifications.smtp_configured ? "Misconfigured" : notifications.latest_email_status === "failed" ? "Last send failed" : "Active";

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

  useEffect(() => {
    if (contextFromHash(window.location.hash).get("focus") !== "notifications") return;
    window.setTimeout(() => document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }, []);

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
                        <div><span>{trade.market === "options" ? "Underlying price" : "Current price"}</span><strong>{trade.current_price === null ? "—" : formatDecimal(trade.current_price)}</strong><PriceFreshness source={trade.current_price_source} updatedAt={trade.current_price_updated_at} /></div>
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
        <article className="status-card" id="notifications">
          <div className="card-heading">
            <div>
              <p className="eyebrow">System status</p>
              <h3>Operational health</h3>
            </div>
            <StatusBadge variant={connection} showDot>
              {connectionCopy[connection]}
            </StatusBadge>
          </div>
          {!alertsReliable && <p className="alert-reliability-warning">Price alerts are not fully active. Do not rely on email notifications.</p>}
          <dl className="operational-status-list">
            <div><dt>Backend</dt><dd>{connection === "connected" ? "Connected" : "Unavailable"}</dd></div>
            <div><dt>Price monitor</dt><dd>{monitorLabel}</dd></div>
            <div><dt>Email notifications</dt><dd>{emailLabel}</dd></div>
            <div><dt>Recipient configured</dt><dd>{notifications?.recipient_configured ? "Yes" : "No"}</dd></div>
            <div><dt>Provider</dt><dd>{notifications?.provider_name ?? "—"}</dd></div>
            <div><dt>Poll interval</dt><dd>{notifications ? `${notifications.poll_seconds} seconds` : "—"}</dd></div>
            <div><dt>Last monitor cycle</dt><dd>{notifications?.last_monitor_cycle_at ? new Date(notifications.last_monitor_cycle_at).toLocaleString() : "Not recorded"}</dd></div>
            <div><dt>Latest email result</dt><dd>{notifications?.latest_email_status ?? "No alert email recorded"}</dd></div>
          </dl>
          <Button variant="secondary" disabled={testEmail.isPending || !notifications?.email_enabled} onClick={() => testEmail.mutate()}>{testEmail.isPending ? "Sending…" : "Send Test Email"}</Button>
          {testEmail.isSuccess && <p className="form-message success-message">Test email sent.</p>}
          {testEmail.isError && <p className="form-message error-message">{requestErrorMessage(testEmail.error)}</p>}
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
