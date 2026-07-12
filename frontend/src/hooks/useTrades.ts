import type { SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { APIError } from "../api";
import type { Trade, TradeHorizon } from "../types";
import { queryKeys, useTradesQuery } from "./queries";

export function useTrades(status?: Trade["status"], tradeHorizon?: TradeHorizon) {
  const queryClient = useQueryClient();
  const tradesQuery = useTradesQuery(status, tradeHorizon);
  const trades = tradesQuery.data ?? [];
  const setTrades = (update: SetStateAction<Trade[]>) => {
    queryClient.setQueryData<Trade[]>(queryKeys.trades(status, tradeHorizon), (current = []) =>
      typeof update === "function" ? update(current) : update,
    );
  };

  const error = tradesQuery.error
    ? tradesQuery.error instanceof APIError
      ? `${tradesQuery.error.code}: ${tradesQuery.error.message}`
      : "Trades could not be loaded. Confirm that the backend is running."
    : "";

  return { trades, setTrades, isLoading: tradesQuery.isLoading, error };
}
