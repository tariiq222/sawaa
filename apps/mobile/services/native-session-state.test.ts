jest.mock('@/stores/secure-storage', () => ({
  setSecureItem: jest.fn().mockResolvedValue(undefined),
  deleteSecureItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/stores/store', () => ({ store: { dispatch: jest.fn() } }));
jest.mock('@/stores/slices/auth-slice', () => ({ logout: jest.fn(() => ({ type: 'auth/logout' })) }));

import { setSecureItem, deleteSecureItem } from '@/stores/secure-storage';
import { store } from '@/stores/store';
import { queryClient } from '@/services/query-client';

const mockSetSecureItem = jest.mocked(setSecureItem);
const mockDeleteSecureItem = jest.mocked(deleteSecureItem);
const mockDispatch = jest.mocked(store.dispatch);

import {
  beginSession,
  clearSessionAtEpoch,
  fenceSession,
  persistSessionTokensAtEpoch,
  shouldRevokeStaleRefresh,
} from './native-session-state';

describe('native session state fencing', () => {
  beforeEach(() => jest.clearAllMocks());

  afterEach(() => queryClient.clear());

  it('clears private query data when a new session starts or logout fences it', () => {
    beginSession();
    queryClient.setQueryData(['private-bookings'], { owner: 'account-a' });

    beginSession();
    expect(queryClient.getQueryData(['private-bookings'])).toBeUndefined();

    queryClient.setQueryData(['private-bookings'], { owner: 'account-b' });
    fenceSession();
    expect(queryClient.getQueryData(['private-bookings'])).toBeUndefined();
  });

  it('does not let a deferred old query repopulate the cache after the boundary clears it', async () => {
    let releaseQuery!: (value: { owner: string }) => void;
    const oldQuery = queryClient.fetchQuery({
      queryKey: ['private-bookings', 'late'],
      gcTime: 0,
      retry: false,
      queryFn: ({ signal }) => new Promise<{ owner: string }>((resolve) => {
        releaseQuery = resolve;
        signal.addEventListener('abort', () => resolve({ owner: 'account-a' }), { once: true });
      }),
    });

    await Promise.resolve();
    beginSession();
    releaseQuery({ owner: 'account-a' });
    await expect(oldQuery).rejects.toBeDefined();

    expect(queryClient.getQueryData(['private-bookings', 'late'])).toBeUndefined();
  });

  it('does not let a refresh write its token after logout fences the session', async () => {
    let releaseAccessWrite!: () => void;
    const accessWrite = new Promise<void>((resolve) => { releaseAccessWrite = resolve; });
    mockSetSecureItem.mockReturnValueOnce(accessWrite);

    const session = beginSession();
    const persist = persistSessionTokensAtEpoch(
      { accessToken: 'stale-access', refreshToken: 'stale-refresh' },
      session,
    );
    await Promise.resolve();
    const logoutSession = fenceSession();
    const clear = clearSessionAtEpoch(logoutSession);

    releaseAccessWrite();
    await expect(persist).resolves.toBe(false);
    await expect(clear).resolves.toBe(true);
    expect(mockSetSecureItem).toHaveBeenCalledWith('accessToken', 'stale-access');
    expect(mockSetSecureItem).not.toHaveBeenCalledWith('refreshToken', 'stale-refresh');
    expect(mockDeleteSecureItem).toHaveBeenNthCalledWith(1, 'accessToken');
    expect(mockDeleteSecureItem).toHaveBeenNthCalledWith(2, 'refreshToken');
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('only asks the refresh caller to revoke a token when logout still owns the fence', () => {
    const session = beginSession();
    fenceSession();
    expect(shouldRevokeStaleRefresh(session)).toBe(true);

    const current = beginSession();
    expect(shouldRevokeStaleRefresh(current)).toBe(false);
  });
});
