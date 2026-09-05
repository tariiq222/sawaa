'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientProfile } from '@sawaa/shared';
import {
  beginLocalLogout,
  completeLocalLogout,
  expireLocalSession,
  getAuthGeneration,
  getAuthIdentitySnapshot,
  getAuthSessionStateSnapshot,
  getClient,
  getServerAuthIdentitySnapshot,
  getServerAuthSessionStateSnapshot,
  setClient,
  subscribeAuth,
} from './auth-store';
import { getMeApi } from './auth.api';

export interface UseCurrentClientResult {
  client: ClientProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  clearSession: () => void;
  confirmLogout: () => void;
  sessionReadBlocked: boolean;
}

/** TanStack Query key for the current client profile — shared so mutations can update the cache. */
export const CURRENT_CLIENT_QUERY_KEY = ['client', 'me'] as const;

function isTerminalAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: unknown }).status;
  return status === 401 || status === 403;
}

export function useCurrentClient(): UseCurrentClientResult {
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);
  const authSessionState = useSyncExternalStore(
    subscribeAuth,
    getAuthSessionStateSnapshot,
    getServerAuthSessionStateSnapshot,
  );
  const authIdentity = useSyncExternalStore(
    subscribeAuth,
    getAuthIdentitySnapshot,
    getServerAuthIdentitySnapshot,
  );
  const authReadsEnabled = authSessionState === 'enabled';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Seed the query cache from localStorage AFTER mount only. Reading it during
  // the first render makes the client HTML diverge from SSR (the server has no
  // localStorage and renders the loading state) → hydration mismatch.
  useEffect(() => {
    const cached = getClient();
    const current = queryClient.getQueryData<ClientProfile | null>(CURRENT_CLIENT_QUERY_KEY);
    if (cached && current?.id !== cached.id) {
      queryClient.setQueryData(CURRENT_CLIENT_QUERY_KEY, cached);
    }
  }, [authIdentity, queryClient]);

  const {
    data: client,
    isLoading,
    error,
    refetch,
  } = useQuery<ClientProfile | null, Error>({
    queryKey: CURRENT_CLIENT_QUERY_KEY,
    queryFn: async ({ signal }) => {
      if (getAuthSessionStateSnapshot() !== 'enabled') return null;
      const generation = getAuthGeneration();
      try {
        const profile = await getMeApi(signal);
        if (mountedRef.current && generation === getAuthGeneration()) setClient(profile);
        return profile;
      } catch (error) {
        if (isTerminalAuthError(error)) {
          if (mountedRef.current && generation === getAuthGeneration()) expireLocalSession();
          return null;
        }
        // Preserve the cached profile and let TanStack Query expose a
        // retryable error for transient network/server failures.
        throw error;
      }
    },
    enabled: authReadsEnabled,
    retry: (failureCount, error) => !isTerminalAuthError(error) && failureCount < 2,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });

  const effectiveClient = client ?? (authIdentity ? getClient() : null);

  const clearSession = useCallback(() => {
    // Close the read gate and increment the generation before touching the
    // cache. This prevents the mounted observer from starting a fresh
    // cookie-backed /me request while logout revocation remains unknown.
    beginLocalLogout();
    void queryClient.cancelQueries().catch(() => undefined);
    queryClient.clear();
  }, [queryClient]);

  return {
    client: effectiveClient,
    isLoading,
    error: error?.message ?? null,
    refetch: async () => {
      if (getAuthSessionStateSnapshot() !== 'enabled') return;
      await refetch();
    },
    clearSession,
    confirmLogout: completeLocalLogout,
    sessionReadBlocked: authSessionState === 'logout-pending',
  };
}
