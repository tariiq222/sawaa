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

  it('refreshes access tokens without overwriting the stored refresh token when backend omits a rotated token', async () => {
    const originalRequest: { headers: Record<string, string>; _retry?: boolean } = { headers: {} };
    jest.mocked(getSecureItem).mockResolvedValueOnce('stored-refresh-token');
    jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { success: true, data: { accessToken: 'new-access-token' } },
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
    expect(setSecureItem).not.toHaveBeenCalledWith('refreshToken', undefined);
    expect(originalRequest.headers.Authorization).toBe('Bearer new-access-token');
    expect(adapter).toHaveBeenCalled();
  });

  it('shares one refresh request and retries every concurrent unauthorized request', async () => {
    const firstRequest: { headers: Record<string, string>; _retry?: boolean } = { headers: {} };
    const secondRequest: { headers: Record<string, string>; _retry?: boolean } = { headers: {} };
    let resolveRefresh: ((value: { data: { success: boolean; data: { accessToken: string } } }) => void) | undefined;
    const refresh = new Promise<{ data: { success: boolean; data: { accessToken: string } } }>((resolve) => {
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
    resolveRefresh?.({ data: { success: true, data: { accessToken: 'new-access-token' } } });
    await Promise.all([first, second]);

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(firstRequest.headers.Authorization).toBe('Bearer new-access-token');
    expect(secondRequest.headers.Authorization).toBe('Bearer new-access-token');
  });

  it('clears the shared session once when a concurrent refresh fails', async () => {
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
    rejectRefresh?.(new Error('refresh failed'));
    await expect(Promise.all([first, second])).rejects.toMatchObject({ response: { status: 401 } });

    expect(deleteSecureItem).toHaveBeenCalledTimes(2);
    expect(deleteSecureItem).toHaveBeenNthCalledWith(1, 'accessToken');
    expect(deleteSecureItem).toHaveBeenNthCalledWith(2, 'refreshToken');
    expect(store.dispatch).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
