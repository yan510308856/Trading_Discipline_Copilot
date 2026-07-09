import type {
  APIErrorEnvelope,
  DailyReadinessData,
  DailyReadinessUpdatePayload,
  DailySummaryData,
  HealthResponse,
  OpenTradeAttention,
  QuoteResult,
  QuoteRefreshResult,
  Review,
  ReviewPayload,
  RuleDefinition,
  RuleEvaluationResult,
  Trade,
  TradeClosePayload,
  TradeCreatePayload,
  TradeHorizon,
  TradePatchPayload,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class APIError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "APIError";
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let envelope: APIErrorEnvelope | null = null;
    try {
      envelope = (await response.json()) as APIErrorEnvelope;
    } catch {
      throw new APIError(
        "HTTP_ERROR",
        `Request failed with status ${response.status}`,
      );
    }

    throw new APIError(
      envelope.error.code,
      envelope.error.message,
      envelope.error.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health");
}

export function getDailySummary(date?: string): Promise<DailySummaryData> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiRequest<DailySummaryData>(`/summary/daily${query}`);
}

export function getTodayDailyReadiness(): Promise<DailyReadinessData> {
  return apiRequest<DailyReadinessData>("/daily-readiness/today");
}

export function getDailyReadiness(date: string): Promise<DailyReadinessData> {
  return apiRequest<DailyReadinessData>(
    `/daily-readiness?date=${encodeURIComponent(date)}`,
  );
}

export function updateDailyReadiness(
  date: string,
  payload: DailyReadinessUpdatePayload,
): Promise<DailyReadinessData> {
  return apiRequest<DailyReadinessData>(
    `/daily-readiness/${encodeURIComponent(date)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export function getRules(): Promise<RuleDefinition[]> {
  return apiRequest<RuleDefinition[]>("/rules");
}

export function refreshOpenPrices(): Promise<QuoteRefreshResult> {
  return apiRequest<QuoteRefreshResult>("/market-data/refresh-open", {
    method: "POST",
  });
}

export function getQuote(symbol: string): Promise<QuoteResult> {
  return apiRequest<QuoteResult>(
    `/market-data/quote?symbol=${encodeURIComponent(symbol)}`,
  );
}

export function getOpenTradeAttention(): Promise<OpenTradeAttention[]> {
  return apiRequest<OpenTradeAttention[]>("/rules/open-attention");
}

export function evaluateRules(
  tradeDraft: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<RuleEvaluationResult> {
  return apiRequest<RuleEvaluationResult>("/rules/evaluate", {
    method: "POST",
    body: JSON.stringify(tradeDraft),
    signal,
  });
}

export function createTrade(trade: TradeCreatePayload): Promise<Trade> {
  return apiRequest<Trade>("/trades", {
    method: "POST",
    body: JSON.stringify(trade),
  });
}

export function saveChecklistAnswers(
  tradeId: number,
  answers: Record<string, boolean>,
): Promise<Trade> {
  return apiRequest<Trade>(`/trades/${tradeId}/checklist`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export function getTrades(
  status?: Trade["status"],
  tradeHorizon?: TradeHorizon,
): Promise<Trade[]> {
  const query = new URLSearchParams({ limit: "500" });
  if (status) query.set("status", status);
  if (tradeHorizon) query.set("trade_horizon", tradeHorizon);
  return apiRequest<Trade[]>(`/trades?${query.toString()}`);
}

export function deleteTrade(tradeId: number): Promise<void> {
  return apiRequest<void>(`/trades/${tradeId}`, { method: "DELETE" });
}

export function patchTrade(
  tradeId: number,
  updates: TradePatchPayload,
): Promise<Trade> {
  return apiRequest<Trade>(`/trades/${tradeId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function openTrade(
  tradeId: number,
  actualEntry: number | null,
): Promise<Trade> {
  return apiRequest<Trade>(`/trades/${tradeId}/open`, {
    method: "POST",
    body: JSON.stringify({ actual_entry: actualEntry }),
  });
}

export function closeTrade(
  tradeId: number,
  closeData: TradeClosePayload,
): Promise<Trade> {
  return apiRequest<Trade>(`/trades/${tradeId}/close`, {
    method: "POST",
    body: JSON.stringify(closeData),
  });
}

export function recordPartialExit(
  tradeId: number,
  price: number,
  quantity: number,
): Promise<Trade> {
  return apiRequest<Trade>(`/trades/${tradeId}/partial-exits`, {
    method: "POST",
    body: JSON.stringify({ price, quantity }),
  });
}

export function createReview(
  tradeId: number,
  review: ReviewPayload,
): Promise<Review> {
  return apiRequest<Review>(`/trades/${tradeId}/review`, {
    method: "POST",
    body: JSON.stringify(review),
  });
}
