import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { router } from 'expo-router';

import { API_URL } from '@/constants/config';
import type { ApiResponse } from '@/types/api';
import { store } from '@/stores/store';
import { logout } from '@/stores/slices/auth-slice';
import {
  getSecureItem,
  setSecureItem,
  deleteSecureItem,
} from '@/stores/secure-storage';
import { clearCurrentOrgId, getCurrentOrgIdSync } from './tenant';

const ORG_SUSPENDED_CODE = 'ORG_SUSPENDED';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tenant header: every request — public and authenticated. On authenticated
// routes the backend's TenantResolverMiddleware ignores this header (JWT
// claim wins); on public routes it scopes catalog data to the active tenant.
// Reads from secure-store cache (hydrated at boot via loadCurrentOrgId),
// falling back to the build-time default for first-launch / pre-login state.
api.interceptors.request.use((config) => {
  const orgId = getCurrentOrgIdSync();
  if (config.headers && typeof (config.headers as { set?: unknown }).set === 'function') {
    (config.headers as { set: (k: string, v: string) => void }).set('X-Org-Id', orgId);
  } else if (config.headers) {
    (config.headers as Record<string, string>)['X-Org-Id'] = orgId;
  }
  return config;
});

// Request interceptor: inject JWT token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getSecureItem('accessToken');
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
    };
    const responseCode =
      error.response?.data?.error ??
      error.response?.data?.message ??
      error.response?.data?.errorCode;

    if (error.response?.status === 401 && responseCode === ORG_SUSPENDED_CODE) {
      await deleteSecureItem('accessToken');
      await deleteSecureItem('refreshToken');
      await clearCurrentOrgId();
      store.dispatch(logout());
      router.replace('/(auth)/suspended');
      return Promise.reject(error);
    }

    // Handle 401 — attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await getSecureItem('refreshToken');
        if (!refreshToken) {
          return Promise.reject(error);
        }

        // Backend exposes POST /auth/refresh — older mobile versions hit
        // /auth/refresh-token by mistake, so refreshes silently failed and
        // users got logged out at every 15-minute access-token expiry.
        const { data } = await axios.post<
          ApiResponse<{ accessToken: string; refreshToken: string }>
        >(`${API_URL}/auth/refresh`, { refreshToken });

        if (data.success && data.data) {
          await setSecureItem('accessToken', data.data.accessToken);
          await setSecureItem('refreshToken', data.data.refreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          }
          return api(originalRequest);
        }
      } catch {
        // Refresh failed — clear tokens + Redux state
        await deleteSecureItem('accessToken');
        await deleteSecureItem('refreshToken');
        await clearCurrentOrgId();
        store.dispatch(logout());
      }
    }

    return Promise.reject(error);
  },
);

export default api;
