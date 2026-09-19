import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { router } from 'expo-router';

import { API_URL } from '@/constants/config';
import type { ApiResponse } from '@/types/api';
import { getSecureItem } from '@/stores/secure-storage';
import {
  clearSession,
  getSessionEpoch,
  isSessionCurrent,
  persistSessionTokensAtEpoch,
  shouldRevokeStaleRefresh,
} from './native-session-state';

const ORG_SUSPENDED_CODE = 'ORG_SUSPENDED';

let refreshAccessTokenPromise: { epoch: number; promise: Promise<string | null> } | null = null;

function refreshAccessToken(): Promise<string | null> {
  const epoch = getSessionEpoch();
  if (!refreshAccessTokenPromise || refreshAccessTokenPromise.epoch !== epoch) {
    let promise: Promise<string | null>;
    promise = (async () => {
      const refreshToken = await getSecureItem('refreshToken');
      if (!refreshToken || !isSessionCurrent(epoch)) {
        return null;
      }

      try {
        const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${API_URL}/mobile/auth/refresh`,
          { refreshToken },
        );

        if (!data?.accessToken || !data.refreshToken) {
          return null;
        }

        const persisted = await persistSessionTokensAtEpoch(
          { accessToken: data.accessToken, refreshToken: data.refreshToken },
          epoch,
        );
        if (!persisted) {
          // Logout may have consumed the old token while this rotation was in
          // flight. Revoke the newly issued token directly, without writing it
          // to storage. A subsequent login clears the logout fence, so it is
          // never revoked by a stale refresh from the prior session.
          if (shouldRevokeStaleRefresh(epoch)) {
            await axios.post(`${API_URL}/mobile/auth/logout`, {
              refreshToken: data.refreshToken,
            });
          }
          return null;
        }

        return data.accessToken;
      } catch (refreshError) {
        const status = (refreshError as AxiosError).response?.status;
        // Preserve a session through transient outages. Only an explicit
        // authentication rejection invalidates local credentials.
        if ((status === 401 || status === 403) && isSessionCurrent(epoch)) {
          await clearSession();
        }
        throw refreshError;
      }
    })().finally(() => {
      if (refreshAccessTokenPromise?.promise === promise) {
        refreshAccessTokenPromise = null;
      }
    });
    refreshAccessTokenPromise = { epoch, promise };
  }

  return refreshAccessTokenPromise.promise;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: inject JWT token. The backend derives organization
// context from auth state and does not read X-Org-Id in this single-tenant app.
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const epoch = getSessionEpoch();
    (config as InternalAxiosRequestConfig & { _sessionEpoch?: number })._sessionEpoch = epoch;
    const token = await getSecureItem('accessToken');
    if (!isSessionCurrent(epoch)) {
      throw new Error('Session changed while preparing request');
    }
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Response interceptor: handle token refresh and errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _sessionEpoch?: number;
    };
    if (!originalRequest) {
      return Promise.reject(error);
    }
    const requestEpoch = originalRequest._sessionEpoch ?? getSessionEpoch();
    if (!isSessionCurrent(requestEpoch)) {
      return Promise.reject(error);
    }
    const responseCode =
      error.response?.data?.error ??
      error.response?.data?.message ??
      error.response?.data?.errorCode;

    if (error.response?.status === 401 && responseCode === ORG_SUSPENDED_CODE) {
      await clearSession();
      router.replace('/(auth)/suspended');
      return Promise.reject(error);
    }

    // Handle 401 — attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        if (accessToken && isSessionCurrent(requestEpoch)) {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(originalRequest);
        }
      } catch {
        // refreshAccessToken() has already cleared the shared session.
      }
    }

    return Promise.reject(error);
  },
);

export default api;
