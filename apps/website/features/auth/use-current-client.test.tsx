import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

const getMeApiMock = vi.fn();
const setClientMock = vi.fn();
const getClientMock = vi.fn();
const clearAuthMock = vi.fn();
let authGeneration = 0;
let authSessionState: 'enabled' | 'logout-pending' | 'signed-out' = 'enabled';
const authListeners = new Set<() => void>();

vi.mock('./auth.api', () => ({
  getMeApi: (...args: unknown[]) => getMeApiMock(...args),
}));

vi.mock('./auth-store', () => ({
  setClient: (...args: unknown[]) => setClientMock(...args),
  getClient: () => getClientMock(),
  clearAuth: () => {
    authGeneration += 1;
    clearAuthMock();
    authListeners.forEach((listener) => listener());
  },
  expireLocalSession: () => {
    authSessionState = 'signed-out';
    authGeneration += 1;
    getClientMock.mockReturnValue(null);
    clearAuthMock();
    authListeners.forEach((listener) => listener());
  },
  getAuthGeneration: () => authGeneration,
  getAuthIdentitySnapshot: () => getClientMock()?.id ?? null,
  getServerAuthIdentitySnapshot: () => null,
  getAuthSessionStateSnapshot: () => authSessionState,
  getServerAuthSessionStateSnapshot: () => 'signed-out',
  beginLocalLogout: () => {
    authSessionState = 'logout-pending';
    authGeneration += 1;
    clearAuthMock();
    authListeners.forEach((listener) => listener());
  },
  completeLocalLogout: () => {
    authSessionState = 'signed-out';
    authListeners.forEach((listener) => listener());
  },
  subscribeAuth: (listener: () => void) => {
    authListeners.add(listener);
    return () => authListeners.delete(listener);
  },
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ClientProfile } from '@sawaa/shared';
import { PublicFetchError } from '@/lib/public-fetch';
import {
  useCurrentClient,
  CURRENT_CLIENT_QUERY_KEY,
} from './use-current-client';

const fakeProfile: ClientProfile = {
  id: 'c1',
  name: 'Sara',
  email: 'sara@test.com',
  phone: '+966500000000',
  emailVerified: '2026-01-01T00:00:00.000Z',
  phoneVerified: null,
  accountType: 'REGISTERED',
  claimedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function wrapper(client: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

describe('useCurrentClient', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    authGeneration = 0;
    authSessionState = 'enabled';
    authListeners.clear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });
    getClientMock.mockReturnValue(null);
  });

  it('exposes a stable query key', () => {
    expect(CURRENT_CLIENT_QUERY_KEY).toEqual(['client', 'me']);
  });

  it('returns isLoading=true until the me() call resolves, then the profile', async () => {
    getMeApiMock.mockResolvedValue(fakeProfile);
    const { result } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.client).toEqual(fakeProfile);
    expect(result.current.error).toBeNull();
    expect(getMeApiMock).toHaveBeenCalledTimes(1);
  });

  it('calls setClient with the fetched profile on success', async () => {
    getMeApiMock.mockResolvedValue(fakeProfile);
    const { result } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(result.current.client).toEqual(fakeProfile));
    expect(setClientMock).toHaveBeenCalledWith(fakeProfile);
  });

  it('clears local auth when the me() call returns terminal 401', async () => {
    getMeApiMock.mockRejectedValue(new PublicFetchError(401, { message: 'unauthorized' }));
    const { result } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(clearAuthMock).toHaveBeenCalledOnce());
    expect(result.current.client).toBeNull();
    expect(result.current.sessionReadBlocked).toBe(false);
  });

  it('replaces a fresh terminal-null cache after explicit login before account remount', async () => {
    getMeApiMock.mockRejectedValueOnce(new PublicFetchError(401, { message: 'unauthorized' }));
    const { result, rerender } = renderHook(() => useCurrentClient(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(clearAuthMock).toHaveBeenCalledOnce());
    expect(queryClient.getQueryData(CURRENT_CLIENT_QUERY_KEY)).toBeNull();

    // Model the successful login flow: setClient(profile) updates the store
    // identity and publishes to mounted/remounted auth consumers.
    getClientMock.mockReturnValue(fakeProfile);
    authSessionState = 'enabled';
    act(() => authListeners.forEach((listener) => listener()));
    rerender();

    await waitFor(() => expect(result.current.client).toEqual(fakeProfile));
    expect(queryClient.getQueryData(CURRENT_CLIENT_QUERY_KEY)).toEqual(fakeProfile);
    expect(result.current.sessionReadBlocked).toBe(false);
  });

  it('retains a cached profile after a transient /me failure and lets the caller retry', async () => {
    getClientMock.mockReturnValue(fakeProfile);
    queryClient.setQueryData(CURRENT_CLIENT_QUERY_KEY, fakeProfile);
    getMeApiMock.mockRejectedValue(new PublicFetchError(503, { message: 'temporary outage' }));

    const { result } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });

    await result.current.refetch();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.client).toEqual(fakeProfile);
    expect(setClientMock).not.toHaveBeenCalledWith(null);

    const recovered = { ...fakeProfile, name: 'Recovered Sara' };
    getMeApiMock.mockResolvedValueOnce(recovered);
    await result.current.refetch();

    await waitFor(() => expect(result.current.client).toEqual(recovered));
    expect(setClientMock).toHaveBeenCalledWith(recovered);
  });

  it('clears a cached profile for a terminal 401 response', async () => {
    getClientMock.mockReturnValue(fakeProfile);
    queryClient.setQueryData(CURRENT_CLIENT_QUERY_KEY, fakeProfile);
    getMeApiMock.mockRejectedValueOnce(new PublicFetchError(401, { message: 'unauthorized' }));

    const { result } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });

    await result.current.refetch();
    await waitFor(() => expect(clearAuthMock).toHaveBeenCalledOnce());
    expect(result.current.client).toBeNull();
  });

  it('cancels the profile query and rejects a late profile write when clearing the session', async () => {
    let resolveProfile!: (profile: ClientProfile) => void;
    let profileSignal: AbortSignal | undefined;
    getMeApiMock.mockImplementation((signal?: AbortSignal) => {
      profileSignal = signal;
      return new Promise<ClientProfile>((resolve) => {
        resolveProfile = resolve;
      });
    });
    queryClient.setQueryData(['client', 'bookings'], [{ id: 'booking-1' }]);
    queryClient.setQueryData(['client', 'invoices'], [{ id: 'invoice-1' }]);

    const { result } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(getMeApiMock).toHaveBeenCalledOnce());

    act(() => result.current.clearSession());
    resolveProfile(fakeProfile);
    await Promise.resolve();

    expect(clearAuthMock).toHaveBeenCalledOnce();
    expect(profileSignal?.aborted).toBe(true);
    expect(setClientMock).not.toHaveBeenCalledWith(fakeProfile);
    expect(queryClient.getQueryData(CURRENT_CLIENT_QUERY_KEY)).toBeUndefined();
    expect(queryClient.getQueryData(['client', 'bookings'])).toBeUndefined();
    expect(queryClient.getQueryData(['client', 'invoices'])).toBeUndefined();
  });

  it('blocks fresh profile reads after local clearing while the logout cookie may survive', async () => {
    getMeApiMock.mockResolvedValue(fakeProfile);
    const { result, rerender } = renderHook(() => useCurrentClient(), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(setClientMock).toHaveBeenCalledWith(fakeProfile));
    const profileWritesBeforeClear = setClientMock.mock.calls.length;

    act(() => result.current.clearSession());
    rerender();
    window.dispatchEvent(new Event('focus'));
    await act(async () => {
      await result.current.refetch();
      await Promise.resolve();
    });

    expect(result.current.sessionReadBlocked).toBe(true);
    expect(getMeApiMock).toHaveBeenCalledTimes(1);
    expect(setClientMock).toHaveBeenCalledTimes(profileWritesBeforeClear);
  });

  it('does not write a late profile after the hook has unmounted', async () => {
    let resolveProfile!: (profile: ClientProfile) => void;
    getMeApiMock.mockReturnValue(
      new Promise<ClientProfile>((resolve) => {
        resolveProfile = resolve;
      }),
    );

    const { unmount } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(getMeApiMock).toHaveBeenCalledOnce());
    unmount();

    resolveProfile(fakeProfile);
    await Promise.resolve();
    expect(setClientMock).not.toHaveBeenCalledWith(fakeProfile);
  });

  it('seeds the query cache from localStorage AFTER mount', async () => {
    getClientMock.mockReturnValue(fakeProfile);
    // Before mount the cache is empty.
    expect(queryClient.getQueryData(CURRENT_CLIENT_QUERY_KEY)).toBeUndefined();
    getMeApiMock.mockResolvedValue(fakeProfile);
    renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });
    // After mount the seeded value is present (without waiting for the fetch).
    expect(queryClient.getQueryData(CURRENT_CLIENT_QUERY_KEY)).toEqual(fakeProfile);
  });

  it('does NOT overwrite the cache when localStorage returns a value but the cache is already set', async () => {
    queryClient.setQueryData(CURRENT_CLIENT_QUERY_KEY, { ...fakeProfile, name: 'Cached' });
    getClientMock.mockReturnValue({ ...fakeProfile, name: 'LocalStorage' });
    getMeApiMock.mockResolvedValue(fakeProfile);
    const { result } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // The cache survives the effect — only the query refresh can replace it.
    expect(queryClient.getQueryData(CURRENT_CLIENT_QUERY_KEY)).toEqual({
      ...fakeProfile,
      name: 'Cached',
    });
  });

  it('exposes a refetch() that re-invokes getMeApi', async () => {
    getMeApiMock.mockResolvedValue(fakeProfile);
    const { result } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getMeApiMock).toHaveBeenCalledTimes(1);
    await result.current.refetch();
    expect(getMeApiMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces the thrown error message via the error field when me() rejects', async () => {
    getMeApiMock.mockRejectedValue(new Error('Network down'));
    const { result } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.error).toBe('Network down'));
    expect(clearAuthMock).not.toHaveBeenCalled();
  });
});
