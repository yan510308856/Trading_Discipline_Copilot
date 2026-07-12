import { useState } from "react";

import { APIError } from "../api";
import { useDailySummaryQuery } from "../hooks/queries";
import {
  HorizonFilter,
  type HorizonFilterValue,
  horizonForApi,
} from "./HorizonFilter";
import { SummaryCards } from "./SummaryCards";

function todayKey(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readableTag(tag: string): string {
  return tag.replaceAll("_", " ");
}

function requestErrorMessage(error: unknown): string {
  return error instanceof APIError
    ? `${error.code}: ${error.message}`
    : "Could not load the selected daily summary.";
}

export function DailySummary() {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [horizonFilter, setHorizonFilter] = useState<HorizonFilterValue>("all");
  const summaryQuery = useDailySummaryQuery(selectedDate, horizonForApi(horizonFilter));
  const summary = summaryQuery.data ?? null;
  const isLoading = summaryQuery.isLoading;
  const error = summaryQuery.error ? requestErrorMessage(summaryQuery.error) : "";

  return (
    <section className="daily-summary-page">
      <div className="daily-summary-heading">
        <div>
          <p className="eyebrow">Reflection</p>
          <h2>Turn today&apos;s trades into tomorrow&apos;s discipline.</h2>
        </div>
        <div className="summary-controls">
          <HorizonFilter value={horizonFilter} onChange={setHorizonFilter} />
          <label>
            Summary date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
        </div>
      </div>

      {isLoading && <p className="empty-state">Loading daily summary…</p>}
      {error && <p className="form-message error-message">{error}</p>}
      {!isLoading && !error && summary?.total_trades === 0 && (
        <div className="empty-state">
          <strong>No trades recorded on {selectedDate}.</strong>
          <p>Select another date or return after completing a trade.</p>
        </div>
      )}

      {!isLoading && !error && summary && summary.total_trades > 0 && (
        <>
          <SummaryCards summary={summary} />
          <div className="daily-review-grid">
            <article className="daily-detail-card">
              <p className="eyebrow">Recurring mistakes</p>
              <h3>What needs attention</h3>
              {summary.most_frequent_mistakes.length === 0 ? (
                <p className="muted">No mistake tags were recorded.</p>
              ) : (
                <ol className="frequency-list">
                  {summary.most_frequent_mistakes.map((mistake) => (
                    <li key={mistake.tag}>
                      <span>{readableTag(mistake.tag)}</span>
                      <strong>{mistake.count}×</strong>
                    </li>
                  ))}
                </ol>
              )}
            </article>

            <article className="daily-detail-card">
              <p className="eyebrow">Lessons</p>
              <h3>Carry this forward</h3>
              {summary.lessons.length === 0 ? (
                <p className="muted">No lessons were recorded.</p>
              ) : (
                <ul className="lesson-list">
                  {summary.lessons.map((lesson, index) => (
                    <li key={`${index}-${lesson}`}>{lesson}</li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  );
}
