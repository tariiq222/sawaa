'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientProfile } from '@sawaa/shared';
import { getClient, setClient } from './auth-store';
import { getMeApi } from './auth.api';

export interface UseCurrentClientResult {
  client: ClientProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** TanStack Query key for the current client profile — shared so mutations can update the cache. */
export const CURRENT_CLIENT_QUERY_KEY = ['client', 'me'] as const;

export function useCurrentClient(): UseCurrentClientResult {
  const queryClient = useQueryClient();

  // Seed the query cache from localStorage AFTER mount only. Reading it during
  // the first render makes the client HTML diverge from SSR (the server has no
  // localStorage and renders the loading state) → hydration mismatch.
  useEffect(() => {
    const cached = getClient();
    if (cached && queryClient.getQueryData(CURRENT_CLIENT_QUERY_KEY) === undefined) {
      queryClient.setQueryData(CURRENT_CLIENT_QUERY_KEY, cached);
    }
  }, [queryClient]);

  const {
    data: client,
    isLoading,
    error,
    refetch,
  } = useQuery<ClientProfile | null, Error>({
    queryKey: CURRENT_CLIENT_QUERY_KEY,
    queryFn: async () => {
      try {
        const profile = await getMeApi();
        setClient(profile);
        return profile;
      } catch {
        // Session expired — clear stale local cache
        setClient(null);
        return null;
      }
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });

  return {
    client: client ?? null,
    isLoading,
    error: error?.message ?? null,
    refetch: async () => {
      await refetch();
    },
  };
}
