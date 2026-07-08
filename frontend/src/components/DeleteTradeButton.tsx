import { useState } from "react";

import { APIError, deleteTrade } from "../api";
import type { Trade } from "../types";

interface DeleteTradeButtonProps {
  trade: Trade;
  onDeleted: (tradeId: number) => void;
}

export function DeleteTradeButton({ trade, onDeleted }: DeleteTradeButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete trade #${trade.id} (${trade.symbol}) and all of its review and execution records? This cannot be undone.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError("");
    try {
      await deleteTrade(trade.id);
      onDeleted(trade.id);
    } catch (requestError) {
      setError(
        requestError instanceof APIError
          ? `${requestError.code}: ${requestError.message}`
          : "The trade could not be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="delete-trade-action">
      <button
        className="danger-button"
        type="button"
        disabled={isDeleting}
        onClick={() => void handleDelete()}
      >
        {isDeleting ? "Deleting…" : "Delete Trade"}
      </button>
      {error && <p className="form-message error-message">{error}</p>}
    </div>
  );
}
