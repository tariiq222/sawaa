'use client';

import { useQuery } from '@tanstack/react-query';
import type { ClientProfile } from '@sawaa/shared';
import { getClient, setClient } from './auth-store';
import { getMeApi } from './auth.api';

export interface UseCurrentClientResult {
  client: ClientProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCurrentClient(): UseCurrentClientResult {
  const initialClient = getClient();

  const {
    data: client,
    isLoading,
    error,
    refetch,
  } = useQuery<ClientProfile | null, Error>({
    queryKey: ['client', 'me'],
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
    initialData: initialClient ?? undefined,
    staleTime: 60_000,
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
