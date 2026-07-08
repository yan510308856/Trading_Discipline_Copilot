import { useCallback, useEffect, useState } from "react";

import { APIError, getDailySummary, getHealth } from "../api";
import type { ConnectionState, DailySummaryData } from "../types";
import { SummaryCards } from "./SummaryCards";

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
  const [summary, setSummary] = useState<DailySummaryData | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  const refreshDashboard = useCallback(async () => {
    setConnection("checking");
    setSummaryError("");
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
      setSummary(await getDailySummary());
    } catch (error) {
      setSummaryError(requestErrorMessage(error));
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="hero-card">
        <p className="eyebrow">Today&apos;s workspace</p>
        <h2 id="dashboard-title">Trade the plan, not the feeling.</h2>
        <p>
          Build deliberate plans, surface discipline risks, and review execution
          without confusing a lucky outcome for a good decision.
        </p>
      </div>

      <section className="dashboard-summary" aria-labelledby="today-summary-title">
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
        </div>

        {isLoadingSummary && <p className="empty-state">Loading today&apos;s summary…</p>}
        {summaryError && <p className="form-message error-message">{summaryError}</p>}
        {!isLoadingSummary && !summaryError && summary?.total_trades === 0 && (
          <div className="empty-state">
            <strong>No trades recorded today.</strong>
            <p>Create a plan when the next valid setup appears.</p>
          </div>
        )}
        {!isLoadingSummary && summary && summary.total_trades > 0 && (
          <SummaryCards summary={summary} />
        )}
      </section>

      <div className="dashboard-grid">
        <article className="status-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">System status</p>
              <h3>Backend connection</h3>
            </div>
            <span className={`status-badge status-${connection}`}>
              <span aria-hidden="true" />
              {connectionCopy[connection]}
            </span>
          </div>
          <p className="muted">
            Summary data comes from the FastAPI <code>/summary/daily</code> endpoint.
          </p>
          {connection === "unavailable" && (
            <button className="secondary-button" onClick={refreshDashboard}>
              Check again
            </button>
          )}
        </article>

        <article className="principle-card">
          <p className="eyebrow">Daily principle</p>
          <blockquote>
            “A good trade can lose. A bad trade can win. Grade the decision.”
          </blockquote>
        </article>
      </div>
    </section>
  );
}
