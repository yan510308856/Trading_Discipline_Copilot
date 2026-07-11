import { useCallback, useEffect, useState } from "react";

import {
  APIError,
  getOpenTradeAttention,
  refreshOpenPrices,
} from "../api";
import type { OpenTradeAttention } from "../types";
import { RuleAlertPanel } from "./RuleAlertPanel";

export function OpenTradeAlerts() {
  const [items, setItems] = useState<OpenTradeAttention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const quoteResult = await refreshOpenPrices();
      const attention = await getOpenTradeAttention();
      setItems(attention);
      if (quoteResult.source === "manual") {
        setError("Finnhub is not configured; alerts use the latest manually recorded prices.");
      } else if (quoteResult.errors.length > 0) {
        setError(
          quoteResult.errors
            .map((item) => `${item.symbol}: ${item.message}`)
            .join(" · "),
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof APIError
          ? `${requestError.code}: ${requestError.message}`
          : "Open-position alerts could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="open-attention-page">
      <div className="open-trades-heading">
        <div>
          <p className="eyebrow">Opened positions</p>
          <h2>What needs attention right now?</h2>
        </div>
        <button className="secondary-button" disabled={isLoading} onClick={() => void refresh()}>
          {isLoading ? "Refreshing…" : "Refresh prices & alerts"}
        </button>
      </div>

      {error && <p className="form-message error-message">{error}</p>}
      {isLoading && <p className="empty-state">Checking open positions…</p>}
      {!isLoading && items.length === 0 && (
        <div className="empty-state">
          <strong>No open positions.</strong>
          <p>Open a planned trade to receive position-specific discipline alerts.</p>
        </div>
      )}

      <div className="attention-list">
        {items.map((item) => (
          <details className="trade-accordion attention-card" key={item.trade.id}>
            <summary className="trade-summary">
              <div className="attention-identity">
                <p className="eyebrow">Trade #{item.trade.id}</p>
                <h3>{item.trade.symbol} <span>{item.trade.direction}</span></h3>
              </div>
              <strong className={item.current_r !== null && item.current_r < 0 ? "attention-r negative" : "attention-r"}>
                {item.current_r === null
                  ? "—"
                  : `${item.current_r >= 0 ? "+" : ""}${item.current_r.toFixed(2)}R`}
              </strong>
              <span className="attention-message">
                {item.primary_alert?.message ?? "No active discipline warning"}
              </span>
            </summary>
            <RuleAlertPanel status={item.status} alerts={item.alerts} />
          </details>
        ))}
      </div>
    </section>
  );
}
