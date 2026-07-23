import { useState } from "react";

import { APIError } from "../api";
import { useDisciplineAnalyticsQuery } from "../hooks/queries";
import type { AnalyticsFilters } from "../types";
import { entryTriggerOptions, locationTagOptions, marketStateOptions, tradeThesisOptions } from "../utils/priceActionTaxonomy";

type MetricProps = { label: string; value: string; definition: string };

function Metric({ label, value, definition }: MetricProps) {
  return <article className="analytics-metric"><span>{label}</span><strong>{value}</strong><small>{definition}</small></article>;
}

function number(value: number | null, suffix = ""): string {
  return value === null ? "No recorded data" : `${value.toFixed(2)}${suffix}`;
}

function rate(value: number | null): string {
  return value === null ? "No recorded data" : `${(value * 100).toFixed(1)}%`;
}

function readable(value: string): string { return value.replaceAll("_", " "); }

export function DisciplineAnalytics() {
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const analyticsQuery = useDisciplineAnalyticsQuery(filters);
  const data = analyticsQuery.data;
  const set = (key: keyof AnalyticsFilters, value: string) => setFilters((current) => ({ ...current, [key]: value || undefined }));
  const error = analyticsQuery.error instanceof APIError
    ? `${analyticsQuery.error.code}: ${analyticsQuery.error.message}`
    : analyticsQuery.error ? "Discipline analytics could not be loaded." : "";

  return <section className="discipline-analytics-page">
    <div className="analytics-heading">
      <div><p className="eyebrow">Process evidence</p><h2>Discipline effectiveness</h2><p>Measure preparation, planning, execution, and review behavior independently from profit.</p></div>
      <span className="analytics-timezone">Date boundaries: UTC</span>
    </div>
    <div className="analytics-filters" aria-label="Analytics filters">
      <label>From<input type="date" value={filters.date_from ?? ""} onChange={(event) => set("date_from", event.target.value)} /></label>
      <label>To<input type="date" value={filters.date_to ?? ""} onChange={(event) => set("date_to", event.target.value)} /></label>
      <label>Horizon<select value={filters.trade_horizon ?? ""} onChange={(event) => set("trade_horizon", event.target.value)}><option value="">All</option>{["intraday", "swing", "leap", "other"].map((item) => <option key={item} value={item}>{item === "leap" ? "LEAP" : item}</option>)}</select></label>
      <label>Market<select value={filters.market ?? ""} onChange={(event) => set("market", event.target.value)}><option value="">All</option>{["stocks", "options", "futures", "crypto", "forex", "other"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Market State<select value={filters.market_state ?? ""} onChange={(event) => set("market_state", event.target.value)}><option value="">All</option>{marketStateOptions.map((item) => <option key={item.value} value={item.value}>{item.english} / {item.chinese}</option>)}</select></label>
      <label>Trade Thesis<select value={filters.trade_thesis ?? ""} onChange={(event) => set("trade_thesis", event.target.value)}><option value="">All</option>{tradeThesisOptions.map((item) => <option key={item.value} value={item.value}>{item.english} / {item.chinese}</option>)}</select></label>
      <label>Entry Trigger<select value={filters.entry_trigger ?? ""} onChange={(event) => set("entry_trigger", event.target.value)}><option value="">All</option>{entryTriggerOptions.map((item) => <option key={item.value} value={item.value}>{item.english} / {item.chinese}</option>)}</select></label>
      <label>Location<select value={filters.location_tag ?? ""} onChange={(event) => set("location_tag", event.target.value)}><option value="">All</option>{locationTagOptions.map((item) => <option key={item.value} value={item.value}>{item.english} / {item.chinese}</option>)}</select></label>
      <label>Legacy setup <small>Deprecated</small><input value={filters.setup ?? ""} placeholder="All legacy setups" onChange={(event) => set("setup", event.target.value)} /></label>
    </div>
    {analyticsQuery.isLoading && <p className="empty-state">Loading discipline analytics…</p>}
    {error && <p className="form-message error-message">{error}</p>}
    {data && <div className="analytics-sections">
      <section><h3>Preparation</h3><div className="analytics-grid">
        <Metric label="Readiness days recorded" value={String(data.preparation.readiness_days_recorded)} definition="Persisted daily readiness records; missing days are not inferred." />
        <Metric label="Readiness days cleared" value={String(data.preparation.readiness_days_cleared)} definition="Recorded days that completed every required readiness item." />
        <Metric label="Readiness completion rate" value={rate(data.preparation.readiness_completion_rate)} definition="Cleared readiness days / recorded readiness days." />
        <Metric label="Average required items completed" value={number(data.preparation.average_required_items_completed)} definition="Mean completed required items across recorded days." />
      </div></section>
      <section><h3>Planning Quality</h3><div className="analytics-grid">
        <Metric label="Plans created" value={String(data.planning_quality.plans_created)} definition="Trade plans created in the selected period." />
        <Metric label="Blocked plan attempts" value={String(data.planning_quality.blocked_plan_attempts)} definition="Meaningful blocked user attempts recorded by WorkflowEvent." />
        <Metric label="Warning finalization attempts" value={String(data.planning_quality.warning_finalization_attempts)} definition="Finalization attempts made while warnings were active." />
        <Metric label="Plans with valid stop" value={rate(data.planning_quality.percent_plans_with_valid_stop)} definition="Plans with positive underlying risk / all plans." />
        <Metric label="Plans with position size" value={rate(data.planning_quality.percent_plans_with_position_size)} definition="Plans with a positive position size / all plans." />
        <Metric label="Average planned R/R" value={number(data.planning_quality.average_planned_risk_reward, "R")} definition="Mean Target 1 reward / underlying risk for valid plans." />
        <Metric label="Average total planned risk" value={number(data.planning_quality.average_total_planned_risk)} definition="Mean underlying risk per unit × position size." />
      </div></section>
      <section><h3>Execution Discipline</h3><div className="analytics-grid">
        <Metric label="Trades opened" value={String(data.execution_discipline.trades_opened)} definition="Trades whose opened time is in the selected period." />
        <Metric label="Partial exit rate" value={rate(data.execution_discipline.partial_exit_rate)} definition="Opened trades with a partial execution / all opened trades." />
        <Metric label="Runner activations" value={String(data.execution_discipline.trades_with_runner_activated)} definition="Distinct trades with an audited runner activation; legacy actions may be absent." />
        <Metric label="Runner without stop" value={String(data.execution_discipline.runner_without_stop_occurrences)} definition="Recorded runner-protection rule occurrences." />
        <Metric label="Green-to-red warnings" value={String(data.execution_discipline.green_to_red_warning_occurrences)} definition="Recorded green-to-red rule occurrences." />
        <Metric label="Average exit executions" value={number(data.execution_discipline.average_number_of_exit_executions)} definition="Exit execution records / opened trades." />
        <Metric label="Auto-closed trades" value={String(data.execution_discipline.auto_closed_trade_count)} definition="trade_auto_closed workflow events." />
      </div></section>
      <section><h3>Review Completion</h3><div className="analytics-grid">
        <Metric label="Closed trades" value={String(data.review_completion.closed_trades)} definition="Trades closed in the selected period." />
        <Metric label="Reviewed trades" value={String(data.review_completion.reviewed_trades)} definition="Selected closed trades with a saved review." />
        <Metric label="Review completion rate" value={rate(data.review_completion.review_completion_rate)} definition="Reviewed closed trades / all closed trades." />
        <Metric label="Median review delay" value={number(data.review_completion.median_close_to_review_minutes, " min")} definition="Median minutes from close to saved review." />
        <Metric label="Reviews within 24 hours" value={String(data.review_completion.reviews_within_24_hours)} definition="Reviews saved no later than 24 hours after close." />
        <Metric label="24-hour review rate" value={rate(data.review_completion.review_within_24_hours_rate)} definition="Reviews within 24 hours / reviewed closed trades." />
        <Metric label="Pending reviews" value={String(data.review_completion.pending_review_count)} definition="Closed trades without a saved review." />
      </div></section>
      <section><h3>Notification Reliability</h3><div className="analytics-grid">
        <Metric label="Threshold events" value={String(data.notification_reliability.threshold_events)} definition="Persisted Target 1, Target 2, and stop threshold events." />
        <Metric label="Emails sent" value={String(data.notification_reliability.emails_sent)} definition="Threshold events with sent status." />
        <Metric label="Emails failed" value={String(data.notification_reliability.emails_failed)} definition="Threshold events currently marked failed." />
        <Metric label="Email success rate" value={rate(data.notification_reliability.email_success_rate)} definition="Successfully sent threshold emails / attempted threshold email events." />
        <Metric label="Retries exhausted" value={String(data.notification_reliability.retry_exhausted_events)} definition="Unsent events at or above the configured retry limit." />
        <Metric label="Latest failure" value={data.notification_reliability.latest_failure_at ? new Date(data.notification_reliability.latest_failure_at).toLocaleString() : "No recorded failure"} definition="Most recent update time among failed threshold events." />
      </div></section>
      <section><h3>Recurring Mistakes</h3><div className="analytics-tables">
        {([["Mistake tags", data.recurring_issues.most_frequent_mistake_tags], ["Blocking rules", data.recurring_issues.most_frequent_blocking_rules], ["Warning rules", data.recurring_issues.most_frequent_warning_rules]] as const).map(([title, rows]) => <div key={title}><h4>{title}</h4>{rows.length ? <table><tbody>{rows.map((row) => <tr key={row.key}><td>{readable(row.key)}</td><td>{row.count}</td></tr>)}</tbody></table> : <p className="muted">No recorded issues.</p>}</div>)}
        <div><h4>Issues by horizon</h4><table><tbody>{data.recurring_issues.issue_breakdown_by_horizon.map((row) => <tr key={row.horizon}><td>{row.horizon === "leap" ? "LEAP" : row.horizon}</td><td>{row.issue_count}</td></tr>)}</tbody></table></div>
      </div></section>
      <section><h3>Outcome Context</h3><p className="analytics-note">For stocks and options alike, every R value below is Underlying R—the result of the underlying trade thesis.</p><div className="analytics-grid">
        <Metric label="Total Underlying R" value={number(data.outcome_context.total_underlying_r, "R")} definition="Sum of final underlying-price R across closed trades." />
        <Metric label="Average Underlying R" value={number(data.outcome_context.average_underlying_r, "R")} definition="Mean final underlying-price R across closed trades." />
        <Metric label="Median Underlying R" value={number(data.outcome_context.median_underlying_r, "R")} definition="Median final underlying-price R across closed trades." />
        <Metric label="Average discipline score" value={number(data.outcome_context.average_discipline_score)} definition="Mean review discipline score; outcome does not define discipline." />
      </div></section>
    </div>}
  </section>;
}
