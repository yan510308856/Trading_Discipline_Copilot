import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  closeTrade,
  createReview,
  createTrade,
  getDailyReadiness,
  getDailySummary,
  getDisciplineAnalytics,
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
  refreshOpenPrices,
  saveChecklistAnswers,
  deleteTrade,
  getHealth,
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
  HealthResponse,
  AnalyticsFilters,
  TradeFilters,
} from "../types";

export const queryKeys = {
  dailySummary: (date?: string, tradeHorizon?: TradeHorizon) =>
    ["daily-summary", date ?? "today", tradeHorizon ?? "all"] as const,
  dailyReadiness: (date?: string) => ["daily-readiness", date ?? "today"] as const,
  trades: (status?: Trade["status"], tradeHorizon?: TradeHorizon, filters: TradeFilters = {}) =>
    ["trades", status ?? "all", tradeHorizon ?? "all", filters] as const,
  rules: () => ["rules"] as const,
  openTradeAttention: () => ["open-trade-attention"] as const,
  attention: (tradeHorizon?: TradeHorizon) => ["attention", tradeHorizon ?? "all"] as const,
  notificationStatus: () => ["notification-status"] as const,
  priceAlertEvents: (tradeId: number) => ["price-alert-events", tradeId] as const,
  analytics: (filters: AnalyticsFilters = {}) => ["analytics", {
    date_from: filters.date_from ?? null,
    date_to: filters.date_to ?? null,
    trade_horizon: filters.trade_horizon ?? null,
    market: filters.market ?? null,
    setup: filters.setup ?? null,
    market_state: filters.market_state ?? null,
    trade_thesis: filters.trade_thesis ?? null,
    entry_trigger: filters.entry_trigger ?? null,
    location_tag: filters.location_tag ?? null,
  }] as const,
};

export function invalidateTradesAndSummary(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["trades"] });
  void queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
  void queryClient.invalidateQueries({ queryKey: ["attention"] });
  void queryClient.invalidateQueries({ queryKey: ["analytics"] });
}

export function useDisciplineAnalyticsQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.analytics(filters),
    queryFn: () => getDisciplineAnalytics(filters),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
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

export function useTradesQuery(status?: Trade["status"], tradeHorizon?: TradeHorizon, filters: TradeFilters = {}) {
  return useQuery({
    queryKey: queryKeys.trades(status, tradeHorizon, filters),
    queryFn: () => getTrades(status, tradeHorizon, filters),
  });
}

export function useRulesQuery() {
  return useQuery({
    queryKey: queryKeys.rules(),
    queryFn: getRules,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
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
    refetchInterval: 30_000,
  });
}

export function useNotificationStatusQuery() {
  return useQuery({ queryKey: queryKeys.notificationStatus(), queryFn: getNotificationStatus, refetchInterval: 15_000 });
}

export function useHealthQuery() {
  return useQuery<HealthResponse>({ queryKey: ["health"], queryFn: getHealth, refetchInterval: 30_000 });
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
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
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

export function useCreateTradePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ trade, answers }: { trade: TradeCreatePayload; answers: Record<string, boolean> }) => {
      const created = await createTrade(trade);
      try {
        await saveChecklistAnswers(created.id, answers);
        return { trade: created, checklistSaved: true as const, checklistError: null };
      } catch (checklistError) {
        return { trade: created, checklistSaved: false as const, checklistError };
      }
    },
    onSettled: () => invalidateTradesAndSummary(queryClient),
  });
}

export function useRefreshOpenPricesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refreshOpenPrices,
    onSuccess: () => {
      invalidateTradesAndSummary(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["price-alert-events"] });
    },
  });
}

export function useDeleteTradeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTrade,
    onSuccess: () => invalidateTradesAndSummary(queryClient),
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
      optionEntryPrice,
    }: {
      tradeId: number;
      actualEntry: number | null;
      optionEntryPrice?: number | null;
    }) => openTrade(tradeId, actualEntry, optionEntryPrice),
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
