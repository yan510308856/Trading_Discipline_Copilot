import { useCallback, useEffect, useState } from "react";

import { getHealth } from "../api";
import type { ConnectionState } from "../types";

const connectionCopy: Record<ConnectionState, string> = {
  checking: "Checking backend…",
  connected: "Backend connected",
  unavailable: "Backend unavailable",
};

export function Dashboard() {
  const [connection, setConnection] = useState<ConnectionState>("checking");

  const checkConnection = useCallback(async () => {
    setConnection("checking");
    try {
      const health = await getHealth();
      setConnection(health.status === "ok" ? "connected" : "unavailable");
    } catch {
      setConnection("unavailable");
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

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
            The dashboard checks the FastAPI <code>/health</code> endpoint through
            the Vite development proxy.
          </p>
          {connection === "unavailable" && (
            <button className="secondary-button" onClick={checkConnection}>
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
