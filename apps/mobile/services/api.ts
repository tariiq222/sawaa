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

const ORG_SUSPENDED_CODE = 'ORG_SUSPENDED';

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
          ApiResponse<{ accessToken: string; refreshToken?: string }>
        >(`${API_URL}/auth/refresh`, { refreshToken });

        if (data.success && data.data) {
          await setSecureItem('accessToken', data.data.accessToken);
          if (data.data.refreshToken) {
            await setSecureItem('refreshToken', data.data.refreshToken);
          }

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          }
          return api(originalRequest);
        }
      } catch {
        // Refresh failed — clear tokens + Redux state
        await deleteSecureItem('accessToken');
        await deleteSecureItem('refreshToken');
        store.dispatch(logout());
      }
    }

    return Promise.reject(error);
  },
);

export default api;
