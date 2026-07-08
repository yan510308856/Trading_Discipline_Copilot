import type { HealthResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Backend health check failed with status ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
}
