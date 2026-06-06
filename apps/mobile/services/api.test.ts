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
import { getSecureItem, setSecureItem } from '@/stores/secure-storage';

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
});
