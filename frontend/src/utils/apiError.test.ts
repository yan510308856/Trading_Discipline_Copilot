import { describe, expect, it } from "vitest";
import { APIError } from "../api";
import { frontendErrorMessage } from "./apiError";

describe("frontendErrorMessage", () => {
  it("differentiates validation, quote, email, and backend failures", () => {
    expect(frontendErrorMessage(new APIError("VALIDATION_ERROR", "Bad size"), "fallback")).toContain("Validation");
    expect(frontendErrorMessage(new APIError("FINNHUB_UNAVAILABLE", "Offline"), "fallback")).toContain("Quote unavailable");
    expect(frontendErrorMessage(new APIError("EMAIL_SEND_FAILED", "Rejected"), "fallback")).toContain("Email delivery");
    expect(frontendErrorMessage(new APIError("HTTP_ERROR", "Disconnected"), "fallback")).toContain("Backend unavailable");
  });
});
