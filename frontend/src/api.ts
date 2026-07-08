import type {
  APIErrorEnvelope,
  HealthResponse,
  RuleEvaluationResult,
  Trade,
  TradeCreatePayload,
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

  return response.json() as Promise<T>;
}

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health");
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
