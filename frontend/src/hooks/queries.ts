import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  closeTrade,
  createReview,
  createTrade,
  getDailyReadiness,
  getDailySummary,
  getOpenTradeAttention,
  getAttention,
  getNotificationStatus,
  getPriceAlertEvents,
  getRules,
  getTodayDailyReadiness,
  getTrades,
  openTrade,
  patchTrade,
  recordPartialExit,
  sendTestEmail,
  updateDailyReadiness,
} from "../api";
import type {
  DailyReadinessUpdatePayload,
  ReviewPayload,
  Trade,
  TradeClosePayload,
  TradeCreatePayload,
  TradeHorizon,
  TradePatchPayload,
  ExitReason,
} from "../types";

export const queryKeys = {
  dailySummary: (date?: string, tradeHorizon?: TradeHorizon) =>
    ["daily-summary", date ?? "today", tradeHorizon ?? "all"] as const,
  dailyReadiness: (date?: string) => ["daily-readiness", date ?? "today"] as const,
  trades: (status?: Trade["status"], tradeHorizon?: TradeHorizon) =>
    ["trades", status ?? "all", tradeHorizon ?? "all"] as const,
  rules: () => ["rules"] as const,
  openTradeAttention: () => ["open-trade-attention"] as const,
  attention: (tradeHorizon?: TradeHorizon) => ["attention", tradeHorizon ?? "all"] as const,
  notificationStatus: () => ["notification-status"] as const,
  priceAlertEvents: (tradeId: number) => ["price-alert-events", tradeId] as const,
};

function invalidateTradesAndSummary(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["trades"] });
  void queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
  void queryClient.invalidateQueries({ queryKey: ["attention"] });
}

export function useDailySummaryQuery(date?: string, tradeHorizon?: TradeHorizon) {
  return useQuery({
    queryKey: queryKeys.dailySummary(date, tradeHorizon),
    queryFn: () => getDailySummary(date, tradeHorizon),
  });
}

export function useDailyReadinessQuery(date?: string) {
  return useQuery({
    queryKey: queryKeys.dailyReadiness(date),
    queryFn: () => (date ? getDailyReadiness(date) : getTodayDailyReadiness()),
  });
}

export function useTradesQuery(status?: Trade["status"], tradeHorizon?: TradeHorizon) {
  return useQuery({
    queryKey: queryKeys.trades(status, tradeHorizon),
    queryFn: () => getTrades(status, tradeHorizon),
  });
}

export function useRulesQuery() {
  return useQuery({
    queryKey: queryKeys.rules(),
    queryFn: getRules,
  });
}

export function useOpenTradeAttentionQuery() {
  return useQuery({
    queryKey: queryKeys.openTradeAttention(),
    queryFn: getOpenTradeAttention,
  });
}

export function useAttentionQuery(tradeHorizon?: TradeHorizon) {
  return useQuery({
    queryKey: queryKeys.attention(tradeHorizon),
    queryFn: () => getAttention(tradeHorizon),
  });
}

export function useNotificationStatusQuery() {
  return useQuery({ queryKey: queryKeys.notificationStatus(), queryFn: getNotificationStatus });
}

export function usePriceAlertEventsQuery(tradeId: number) {
  return useQuery({ queryKey: queryKeys.priceAlertEvents(tradeId), queryFn: () => getPriceAlertEvents(tradeId) });
}

export function useRecordExitMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, price, quantity, exitReason, optionPrice }: { tradeId: number; price: number; quantity: number; exitReason: ExitReason; optionPrice?: number | null }) =>
      recordPartialExit(tradeId, price, quantity, exitReason, optionPrice),
    onSuccess: (_, variables) => {
      invalidateTradesAndSummary(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.openTradeAttention() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.priceAlertEvents(variables.tradeId) });
    },
  });
}

export function useTestEmailMutation() {
  return useMutation({ mutationFn: sendTestEmail });
}

export function useUpdateDailyReadinessMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      date,
      payload,
    }: {
      date: string;
      payload: DailyReadinessUpdatePayload;
    }) => updateDailyReadiness(date, payload),
    onSuccess: (readiness) => {
      void queryClient.invalidateQueries({ queryKey: ["daily-readiness"] });
      queryClient.setQueryData(queryKeys.dailyReadiness(readiness.readiness_date), readiness);
      queryClient.setQueryData(queryKeys.dailyReadiness(), readiness);
    },
  });
}

export function useCreateTradeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trade: TradeCreatePayload) => createTrade(trade),
    onSuccess: () => {
      invalidateTradesAndSummary(queryClient);
    },
  });
}

export function usePatchTradeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, updates }: { tradeId: number; updates: TradePatchPayload }) =>
      patchTrade(tradeId, updates),
    onSuccess: () => {
      invalidateTradesAndSummary(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.openTradeAttention() });
    },
  });
}

export function useOpenTradeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tradeId,
      actualEntry,
    }: {
      tradeId: number;
      actualEntry: number | null;
    }) => openTrade(tradeId, actualEntry),
    onSuccess: () => {
      invalidateTradesAndSummary(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.openTradeAttention() });
    },
  });
}

export function useCloseTradeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tradeId,
      closeData,
    }: {
      tradeId: number;
      closeData: TradeClosePayload;
    }) => closeTrade(tradeId, closeData),
    onSuccess: () => {
      invalidateTradesAndSummary(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.openTradeAttention() });
    },
  });
}

export function useCreateReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, review }: { tradeId: number; review: ReviewPayload }) =>
      createReview(tradeId, review),
    onSuccess: () => {
      invalidateTradesAndSummary(queryClient);
    },
  });
}
