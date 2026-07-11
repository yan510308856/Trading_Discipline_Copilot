import { useMemo, useState } from "react";

import { useAttentionQuery } from "../hooks/queries";
import type { AttentionSeverity } from "../types";
import { hashWithContext } from "../utils/navigation";
import { HorizonFilter, type HorizonFilterValue, horizonForApi } from "./HorizonFilter";

export function AttentionCenter() {
  const [severity, setSeverity] = useState<AttentionSeverity | "all">("all");
  const [horizon, setHorizon] = useState<HorizonFilterValue>("all");
  const query = useAttentionQuery(horizonForApi(horizon));
  const items = useMemo(
    () => (query.data?.items ?? []).filter((item) => severity === "all" || item.severity === severity),
    [query.data, severity],
  );

  return <section className="open-attention-page attention-center">
    <div className="open-trades-heading"><div><p className="eyebrow">Operational attention</p><h2>Attention Center</h2></div><button className="secondary-button" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Refreshing…" : "Refresh attention"}</button></div>
    <div className="attention-counts" aria-label="Attention summary">
      <div><span>Blockers</span><strong>{query.data?.counts.blocker ?? 0}</strong></div>
      <div><span>Warnings</span><strong>{query.data?.counts.warning ?? 0}</strong></div>
      <div><span>Reminders</span><strong>{query.data?.counts.reminder ?? 0}</strong></div>
    </div>
    <div className="attention-filters">
      <label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as AttentionSeverity | "all")}><option value="all">All</option><option value="blocker">Blocker</option><option value="warning">Warning</option><option value="reminder">Reminder</option></select></label>
      <HorizonFilter value={horizon} onChange={setHorizon} />
    </div>
    {query.isLoading && <p className="empty-state">Checking active attention items…</p>}
    {query.error && <p className="form-message error-message">Attention items could not be loaded.</p>}
    {!query.isLoading && !query.error && items.length === 0 && <div className="empty-state"><strong>No action is currently required.</strong><p>Continue monitoring open trades against their plans.</p></div>}
    <div className="attention-list">{items.map((item) => <button type="button" className={`attention-item severity-${item.severity}`} key={item.id} onClick={() => { window.location.hash = hashWithContext(item.destination_page, item.destination_context); }}><span className="attention-severity">{item.severity}</span><div><strong>{item.title}</strong><p>{item.message}</p><small>Required Action: {item.required_action}</small></div>{item.current_r !== null && <b>{item.current_r.toFixed(2)}R</b>}</button>)}</div>
  </section>;
}
