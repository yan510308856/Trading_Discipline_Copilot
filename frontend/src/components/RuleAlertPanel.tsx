import type { RuleAlert, RuleStatus } from "../types";

interface RuleAlertPanelProps {
  status?: RuleStatus;
  alerts?: RuleAlert[];
  isChecking?: boolean;
}

const statusCopy: Record<RuleStatus, string> = {
  allowed: "Allowed",
  warning: "Warning",
  blocked: "Blocked",
};

const statusMessage: Record<RuleStatus, string> = {
  allowed:
    "No blocker or warning is currently active. Continue only if the plan still makes sense.",
  warning:
    "This trade is allowed only after conscious acknowledgement. Do not treat this as routine.",
  blocked:
    "This trade plan is blocked because it violates a live trading discipline rule.",
};

export function RuleAlertPanel({
  status = "allowed",
  alerts = [],
  isChecking = false,
}: RuleAlertPanelProps) {
  return (
    <section className="rule-panel" aria-live="polite">
      <div className="rule-panel-heading">
        <div>
          <p className="eyebrow">Discipline check</p>
          <h3>Rule evaluation</h3>
        </div>
        <span className={`decision-badge decision-${status}`}>
          {isChecking ? "Checking…" : statusCopy[status]}
        </span>
      </div>
      {!isChecking && (
        <p className={`rule-status-copy status-copy-${status}`}>
          {statusMessage[status]}
        </p>
      )}

      {alerts.length === 0 ? (
        <p className="rule-empty">
          {isChecking
            ? "Reviewing this plan against the discipline rules."
            : "No active discipline alerts for the current plan."}
        </p>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <article
              className={`rule-alert alert-${alert.severity}`}
              key={alert.rule_id}
            >
              <div className="alert-title-row">
                <strong>{alert.message}</strong>
                <span>{alert.severity}</span>
              </div>
              {alert.checklist.length > 0 && (
                <ul className="alert-checklist">
                  {alert.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {alert.next_actions && alert.next_actions.length > 0 && (
                <div className="alert-next-actions">
                  <span>Next actions</span>
                  <ul>
                    {alert.next_actions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {alert.discipline_sentence && (
                <p className="discipline-sentence">
                  {alert.discipline_sentence}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
