"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { useState, type ReactNode } from "react"
import { ApiError } from "@/lib/api"
import "@/lib/zod-setup"

const ReactQueryDevtools = dynamic(
  () => import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools })),
  { ssr: false },
)

/**
 * Retry policy: never retry 4xx (client errors are deterministic — retrying
 * just delays the user-facing error). Retry transient errors (5xx / network)
 * once. This stops the "validation toast appears twice" pattern.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < 1
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,   // 5 min — no refetch on navigate back
            gcTime: 10 * 60_000,     // 10 min in memory
            refetchOnWindowFocus: false,
            refetchOnMount: false,    // don't refetch if data is fresh
            // Pause interval polling in hidden/background tabs — the single
            // biggest reducer of background error noise during outages.
            refetchIntervalInBackground: false,
            retry: shouldRetry,
            // Exponential backoff with jitter ceiling — avoids the immediate
            // double-request thrash on persistent failures.
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
