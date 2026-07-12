import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  });
}

export const queryClient = createAppQueryClient();

export function AppQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
