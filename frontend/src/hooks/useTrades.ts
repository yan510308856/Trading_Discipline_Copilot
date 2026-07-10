import { useEffect, useState } from "react";

import { APIError } from "../api";
import type { Trade, TradeHorizon } from "../types";
import { useTradesQuery } from "./queries";

export function useTrades(status?: Trade["status"], tradeHorizon?: TradeHorizon) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const tradesQuery = useTradesQuery(status, tradeHorizon);

  useEffect(() => {
    if (tradesQuery.data) setTrades(tradesQuery.data);
  }, [tradesQuery.data]);

  const error = tradesQuery.error
    ? tradesQuery.error instanceof APIError
      ? `${tradesQuery.error.code}: ${tradesQuery.error.message}`
      : "Trades could not be loaded. Confirm that the backend is running."
    : "";

  return { trades, setTrades, isLoading: tradesQuery.isLoading, error };
}
