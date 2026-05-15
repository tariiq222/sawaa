/**
 * API Client — Sawaa Dashboard
 *
 * Thin wrapper that wires `@sawaa/api-client` for the dashboard:
 *   - in-memory access token + setter/getter
 *   - same-origin `/api/proxy` baseUrl (Next rewrite → backend)
 *
 * The actual fetch / 401-refresh / envelope-unwrap logic lives in
 * `packages/api-client/src/client.ts`. Keep the public surface
 * (`api`, `ApiError`, `setAccessToken`, `getAccessToken`) stable so
 * existing call sites remain untouched.
 */

import {
  ApiError,
  apiRequest,
  initClient,
} from "@sawaa/api-client"
import type { ApiResponse, PaginatedResponse } from "@/lib/types/common"

export type { ApiResponse, PaginatedResponse }
export { ApiError }

// Same-origin proxy — Next rewrite in next.config.mjs forwards to the
// backend. Going through the proxy lets cookie-bearing endpoints
// (login/refresh/logout) work without cross-port cookie rejection.
const PROXY_BASE_URL = "/api/proxy"

/* ─── Token Management ─── */

const ACCESS_TOKEN_KEY = "sawaa_access_token"
const TOKEN_STORAGE_KEY = "sawaa_token_storage" // "local" | "session"

let accessToken: string | null = null

function getTokenStorage(): Storage {
  if (typeof window === "undefined") return localStorage
  const storageType = localStorage.getItem(TOKEN_STORAGE_KEY)
  return storageType === "session" ? sessionStorage : localStorage
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

function clearAuthState() {
  accessToken = null
  if (typeof window !== "undefined") {
    localStorage.removeItem("sawaa_user")
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  }
}

/* ─── Initialise the shared client (browser only) ─── */

if (typeof window !== "undefined") {
  // Restore token from localStorage/sessionStorage on page load
  const storage = getTokenStorage()
  const storedToken = storage.getItem(ACCESS_TOKEN_KEY)
  if (storedToken) {
    accessToken = storedToken
  }

  initClient({
    baseUrl: PROXY_BASE_URL,
    getAccessToken: () => accessToken,
    onTokenRefreshed: (a) => {
      setAccessToken(a)
      const st = getTokenStorage()
      st.setItem(ACCESS_TOKEN_KEY, a)
    },
    onAuthFailure: () => {
      clearAuthState()
    },
    onOrgSuspended: () => {
      // No-op in single-tenant mode — organizations cannot be suspended.
    },
  })
}

/* ─── HTTP Methods ─── */

type QueryParams = Record<string, string | number | boolean | undefined>

export const api = {
  get<T>(endpoint: string, params?: QueryParams): Promise<T> {
    const url = params ? `${endpoint}?${buildQuery(params)}` : endpoint
    return apiRequest<T>(url)
  },

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return apiRequest<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    })
  },

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return apiRequest<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(body ?? {}),
    })
  },

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return apiRequest<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    })
  },

  delete<T>(endpoint: string, options?: { data?: unknown }): Promise<T> {
    return apiRequest<T>(endpoint, {
      method: "DELETE",
      ...(options?.data !== undefined ? { body: JSON.stringify(options.data) } : {}),
    })
  },

  /**
   * Submit a multipart/form-data POST. apiRequest detects FormData and skips
   * the JSON Content-Type so the browser can compute the boundary.
   */
  postForm<T>(endpoint: string, form: FormData): Promise<T> {
    return apiRequest<T>(endpoint, {
      method: "POST",
      body: form,
    })
  },
}

/* ─── Helpers ─── */

function buildQuery(params: QueryParams): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  )
  return new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString()
}
