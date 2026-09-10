'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

const TRANSIENT_CLIENT_STATUSES = new Set([408, 425, 429]);

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined;

  if (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    !TRANSIENT_CLIENT_STATUSES.has(status)
  ) {
    return false;
  }

  return failureCount < 1;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: shouldRetryQuery,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
