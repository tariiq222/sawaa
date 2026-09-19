jest.mock('@/stores/store', () => ({ store: { dispatch: jest.fn() } }));
jest.mock('@/stores/slices/auth-slice', () => ({ logout: jest.fn() }));
jest.mock('@/stores/secure-storage', () => ({
  getSecureItem: jest.fn().mockResolvedValue(null),
  setSecureItem: jest.fn(),
  deleteSecureItem: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

import api from './api';
import axios from 'axios';
import { store } from '@/stores/store';
import { logout } from '@/stores/slices/auth-slice';
import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from '@/stores/secure-storage';
import { beginSession } from './native-session-state';
import * as nativeSessionState from './native-session-state';

const getRequestInterceptor = () => {
  const interceptor = api.interceptors.request as unknown as {
    handlers: Array<{
      fulfilled: (
        config: { headers?: Record<string, string> },
      ) => Promise<{ headers?: Record<string, string> }>;
    }>;
  };
  return interceptor.handlers[0]!.fulfilled;
};

const getResponseErrorInterceptor = () => {
  const interceptor = api.interceptors.response as unknown as {
    handlers: Array<{
      rejected: (error: {
        response?: { status?: number; data?: { error?: string; message?: string; errorCode?: string } };
        config?: { headers?: Record<string, string>; _retry?: boolean };
      }) => Promise<unknown>;
    }>;
  };
  return interceptor.handlers[0]!.rejected;
};

describe('api client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has a baseURL set to API_URL', () => {
    expect((api.defaults as { baseURL?: string }).baseURL).toBeDefined();
  });

  it('adds bearer auth without sending a legacy organization header', async () => {
    jest.mocked(getSecureItem).mockResolvedValueOnce('access-token');

    const config = await getRequestInterceptor()({ headers: {} });

    expect(config.headers).toEqual({ Authorization: 'Bearer access-token' });
    expect(config.headers).not.toHaveProperty('X-Org-Id');
  });

  it('rejects request preparation when the session changes during SecureStore read', async () => {
    let releaseRead!: (token: string) => void;
    const accessRead = new Promise<string>((resolve) => { releaseRead = resolve; });
    jest.mocked(getSecureItem).mockReturnValueOnce(accessRead);

    const preparing = getRequestInterceptor()({ headers: {} });
    await Promise.resolve();
    beginSession();
    releaseRead('old-session-access');

    await expect(preparing).rejects.toThrow('Session changed while preparing request');
  });

  it('refreshes access and refresh tokens through the native bare contract', async () => {
    const originalRequest: { headers: Record<string, string>; _retry?: boolean } = { headers: {} };
    jest.mocked(getSecureItem).mockResolvedValueOnce('stored-refresh-token');
    jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { accessToken: 'new-access-token', refreshToken: 'rotated-refresh-token' },
    });
    const adapter = jest.fn().mockResolvedValue({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: originalRequest,
    });
    api.defaults.adapter = adapter;

    await getResponseErrorInterceptor()({
      response: { status: 401, data: {} },
      config: originalRequest,
    });

    expect(setSecureItem).toHaveBeenCalledWith('accessToken', 'new-access-token');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/mobile/auth/refresh'),
      { refreshToken: 'stored-refresh-token' },
    );
    expect(setSecureItem).toHaveBeenCalledWith('refreshToken', 'rotated-refresh-token');
    expect(originalRequest.headers.Authorization).toBe('Bearer new-access-token');
    expect(adapter).toHaveBeenCalled();
  });

  it('shares one refresh request and retries every concurrent unauthorized request', async () => {
    const firstRequest: { headers: Record<string, string>; _retry?: boolean } = { headers: {} };
    const secondRequest: { headers: Record<string, string>; _retry?: boolean } = { headers: {} };
    let resolveRefresh: ((value: { data: { accessToken: string; refreshToken: string } }) => void) | undefined;
    const refresh = new Promise<{ data: { accessToken: string; refreshToken: string } }>((resolve) => {
      resolveRefresh = resolve;
    });
    jest.mocked(getSecureItem).mockResolvedValue('stored-refresh-token');
    jest.spyOn(axios, 'post').mockReturnValueOnce(refresh as never);
    const adapter = jest.fn().mockResolvedValue({
      data: {}, status: 200, statusText: 'OK', headers: {}, config: firstRequest,
    });
    api.defaults.adapter = adapter;

    const first = getResponseErrorInterceptor()({ response: { status: 401, data: {} }, config: firstRequest });
    const second = getResponseErrorInterceptor()({ response: { status: 401, data: {} }, config: secondRequest });

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(axios.post).toHaveBeenCalledTimes(1);
    resolveRefresh?.({ data: { accessToken: 'new-access-token', refreshToken: 'rotated-refresh-token' } });
    await Promise.all([first, second]);

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(firstRequest.headers.Authorization).toBe('Bearer new-access-token');
    expect(secondRequest.headers.Authorization).toBe('Bearer new-access-token');
  });

  it('clears the shared session once for a terminal refresh rejection', async () => {
    const firstRequest: { headers: Record<string, string>; _retry?: boolean } = { headers: {} };
    const secondRequest: { headers: Record<string, string>; _retry?: boolean } = { headers: {} };
    let rejectRefresh: ((reason?: Error) => void) | undefined;
    const refresh = new Promise<never>((_resolve, reject) => {
      rejectRefresh = reject;
    });
    jest.mocked(getSecureItem).mockResolvedValue('stored-refresh-token');
    jest.spyOn(axios, 'post').mockReturnValueOnce(refresh as never);

    const first = getResponseErrorInterceptor()({ response: { status: 401, data: {} }, config: firstRequest });
    const second = getResponseErrorInterceptor()({ response: { status: 401, data: {} }, config: secondRequest });

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(axios.post).toHaveBeenCalledTimes(1);
    rejectRefresh?.(Object.assign(new Error('refresh failed'), { response: { status: 401 } }));
    await expect(Promise.all([first, second])).rejects.toMatchObject({ response: { status: 401 } });

    expect(deleteSecureItem).toHaveBeenCalledTimes(2);
    expect(deleteSecureItem).toHaveBeenNthCalledWith(1, 'accessToken');
    expect(deleteSecureItem).toHaveBeenNthCalledWith(2, 'refreshToken');
    expect(store.dispatch).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('preserves tokens during a transient refresh outage', async () => {
    const originalRequest: { headers: Record<string, string>; _retry?: boolean } = { headers: {} };
    jest.mocked(getSecureItem).mockResolvedValueOnce('stored-refresh-token');
    jest.spyOn(axios, 'post').mockRejectedValueOnce(
      Object.assign(new Error('service unavailable'), { response: { status: 503 } }),
    );

    await expect(
      getResponseErrorInterceptor()({ response: { status: 401, data: {} }, config: originalRequest }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(deleteSecureItem).not.toHaveBeenCalled();
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('does not refresh a 401 response that belongs to a fenced session', async () => {
    const priorEpoch = beginSession();
    beginSession();
    const originalRequest: { headers: Record<string, string>; _retry?: boolean; _sessionEpoch?: number } = {
      headers: {},
      _sessionEpoch: priorEpoch,
    };

    await expect(
      getResponseErrorInterceptor()({ response: { status: 401, data: {} }, config: originalRequest }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('does not retry the original request if the session changes after refresh', async () => {
    const originalRequest: { headers: Record<string, string>; _retry?: boolean } = { headers: {} };
    let persistEntered!: () => void;
    let releasePersist!: (value: boolean) => void;
    const entered = new Promise<void>((resolve) => { persistEntered = resolve; });
    const persist = new Promise<boolean>((resolve) => { releasePersist = resolve; });
    const persistSpy = jest
      .spyOn(nativeSessionState, 'persistSessionTokensAtEpoch')
      .mockImplementation(async () => {
        persistEntered();
        return persist;
      });
    jest.mocked(getSecureItem).mockResolvedValue('stored-refresh-token');
    jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { accessToken: 'new-access-token', refreshToken: 'rotated-refresh-token' },
    });
    const adapter = jest.fn();
    api.defaults.adapter = adapter;

    const retry = getResponseErrorInterceptor()({ response: { status: 401, data: {} }, config: originalRequest });
    await entered;
    beginSession();
    releasePersist(true);

    await expect(retry).rejects.toMatchObject({ response: { status: 401 } });
    expect(adapter).not.toHaveBeenCalled();
    persistSpy.mockRestore();
  });
});
