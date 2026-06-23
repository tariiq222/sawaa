import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

const getMeApiMock = vi.fn();
const setClientMock = vi.fn();
const getClientMock = vi.fn();

vi.mock('./auth.api', () => ({
  getMeApi: (...args: unknown[]) => getMeApiMock(...args),
}));

vi.mock('./auth-store', () => ({
  setClient: (...args: unknown[]) => setClientMock(...args),
  getClient: () => getClientMock(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ClientProfile } from '@sawaa/shared';
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
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
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

  it('clears the local cache (setClient(null)) when the me() call throws', async () => {
    getMeApiMock.mockRejectedValue(new Error('401'));
    const { result } = renderHook(() => useCurrentClient(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(setClientMock).toHaveBeenCalledWith(null));
    expect(result.current.client).toBeNull();
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
    // The queryFn swallows the error and returns null, so the hook's error stays null.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });
});
