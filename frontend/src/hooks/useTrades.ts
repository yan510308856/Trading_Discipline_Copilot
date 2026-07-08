import { useEffect, useState } from "react";

import { APIError, getTrades } from "../api";
import type { Trade } from "../types";

export function useTrades(status?: Trade["status"]) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    void getTrades(status)
      .then((loadedTrades) => {
        if (!controller.signal.aborted) {
          setTrades(loadedTrades);
          setError("");
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof APIError
              ? `${requestError.code}: ${requestError.message}`
              : "Trades could not be loaded. Confirm that the backend is running.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [status]);

  return { trades, setTrades, isLoading, error };
}
