import { useMemo, useState } from "react";

import { useAttentionQuery, useDismissWarningMutation, useUndoWarningDismissalMutation } from "../hooks/queries";
import type { AttentionSeverity } from "../types";
import { hashWithContext } from "../utils/navigation";
import { HorizonFilter, type HorizonFilterValue, horizonForApi } from "./HorizonFilter";

export function AttentionCenter() {
  const [severity, setSeverity] = useState<AttentionSeverity | "all">("all");
  const [horizon, setHorizon] = useState<HorizonFilterValue>("all");
  const query = useAttentionQuery(horizonForApi(horizon));
  const dismissMutation = useDismissWarningMutation();
  const undoMutation = useUndoWarningDismissalMutation();
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [undoKey, setUndoKey] = useState<string | null>(null);
  const items = useMemo(
    () => (query.data?.items ?? []).filter((item) => (severity === "all" || item.severity === severity) && (!item.dismissal_key || !hiddenKeys.has(item.dismissal_key))),
    [query.data, severity, hiddenKeys],
  );
  const visibleCounts = useMemo(() => {
    const visible = (query.data?.items ?? []).filter((item) => !item.dismissal_key || !hiddenKeys.has(item.dismissal_key));
    return {
      blocker: visible.filter((item) => item.severity === "blocker").length,
      warning: visible.filter((item) => item.severity === "warning").length,
      reminder: visible.filter((item) => item.severity === "reminder").length,
    };
  }, [query.data, hiddenKeys]);

  async function dismiss(dismissalKey: string, occurrenceKey: string) {
    setHiddenKeys((current) => new Set(current).add(dismissalKey));
    setUndoKey(dismissalKey);
    try {
      await dismissMutation.mutateAsync({ dismissalKey, occurrenceKey });
    } catch {
      setHiddenKeys((current) => {
        const next = new Set(current); next.delete(dismissalKey); return next;
      });
      setUndoKey(null);
    }
  }

  async function undo() {
    if (!undoKey) return;
    const key = undoKey;
    try {
      await undoMutation.mutateAsync(key);
      setHiddenKeys((current) => {
        const next = new Set(current); next.delete(key); return next;
      });
      setUndoKey(null);
    } catch { /* keep the dismissal and Undo available */ }
  }

  return <section className="open-attention-page attention-center">
    <div className="open-trades-heading"><div><p className="eyebrow">Operational attention</p><h2>Attention Center</h2></div><button className="secondary-button" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Refreshing…" : "Refresh attention"}</button></div>
    <div className="attention-counts" aria-label="Attention summary">
      <div><span>Blockers</span><strong>{visibleCounts.blocker}</strong></div>
      <div><span>Warnings</span><strong>{visibleCounts.warning}</strong></div>
      <div><span>Reminders</span><strong>{visibleCounts.reminder}</strong></div>
    </div>
    <div className="attention-filters">
      <label className="horizon-filter">Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as AttentionSeverity | "all")}><option value="all">All</option><option value="blocker">Blocker</option><option value="warning">Warning</option><option value="reminder">Reminder</option></select></label>
      <HorizonFilter value={horizon} onChange={setHorizon} />
    </div>
    {query.isLoading && <p className="empty-state">Checking active attention items…</p>}
    {query.error && <p className="form-message error-message">Attention items could not be loaded.</p>}
    {!query.isLoading && !query.error && items.length === 0 && <div className="empty-state"><strong>No action is currently required.</strong><p>Continue monitoring open trades against their plans.</p></div>}
    {undoKey && <div className="warning-undo" role="status"><span>Warning dismissed.</span><button type="button" onClick={() => void undo()}>Undo</button></div>}
    {dismissMutation.error && <p className="form-message error-message">Warning could not be dismissed.</p>}
    <div className="attention-list">{items.map((item) => <article role="button" tabIndex={0} className={`attention-item severity-${item.severity}`} key={item.id} onClick={() => { window.location.hash = hashWithContext(item.destination_page, item.destination_context); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); window.location.hash = hashWithContext(item.destination_page, item.destination_context); } }}><span className="attention-severity">{item.severity}</span><div><strong>{item.title}</strong><p>{item.message}</p><small>Required Action: {item.required_action}</small></div>{item.current_r !== null && <b>{item.current_r.toFixed(2)}R</b>}{item.dismissible && item.dismissal_key && item.occurrence_key && <button type="button" className="dismiss-warning-button" aria-label="Dismiss warning" onClick={(event) => { event.stopPropagation(); void dismiss(item.dismissal_key!, item.occurrence_key!); }}>×</button>}</article>)}</div>
  </section>;
}
