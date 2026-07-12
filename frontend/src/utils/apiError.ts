import { APIError } from "../api";

export type FrontendErrorKind = "validation" | "backend" | "quote" | "smtp" | "partial" | "stale" | "unknown";

export function frontendErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof APIError)) return fallback;
  if (error.code === "VALIDATION_ERROR") return `Validation: ${error.message}`;
  if (error.code.includes("QUOTE") || error.code.startsWith("FINNHUB")) return `Quote unavailable: ${error.message}`;
  if (error.code.includes("EMAIL") || error.code.includes("SMTP")) return `Email delivery: ${error.message}`;
  if (error.code === "HTTP_ERROR") return `Backend unavailable: ${error.message}`;
  return `${error.code}: ${error.message}`;
}
