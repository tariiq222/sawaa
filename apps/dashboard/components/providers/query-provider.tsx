"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { useState, type ReactNode } from "react"
import "@/lib/zod-setup"

const ReactQueryDevtools = dynamic(
  () => import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools })),
  { ssr: false },
)

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
            retry: 1,
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
