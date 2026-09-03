/** Dashboard adapter for the shared API client and same-origin proxy. */

import {
  ApiError,
  apiBlobRequest,
  apiRequest,
  cancelInFlightRefresh,
  initClient,
} from "@sawaa/api-client"
import type { ApiResponse, PaginatedResponse } from "@/lib/types/common"

export type { ApiResponse, PaginatedResponse }
export { ApiError }

const PROXY_BASE_URL = "/api/proxy"

/* ─── Token Management ─── */

const ACCESS_TOKEN_KEY = "sawaa_access_token"
const TOKEN_STORAGE_KEY = "sawaa_token_storage"

let accessToken: string | null = null
let sessionGeneration = 0
// A fresh browser session may refresh from its httpOnly cookie before an
// in-memory access token exists. Explicit session clearing flips this gate
// off; a subsequent successful login re-enables it via setAccessToken(token).
let acceptsRefreshedTokens = true
const authFailureListeners = new Set<() => void>()

export function setAccessToken(token: string | null) {
  if (token === null) {
    cancelInFlightRefresh()
    sessionGeneration += 1
  }
  accessToken = token
  acceptsRefreshedTokens = token !== null
}

export function getAccessToken(): string | null {
  return accessToken
}

export function getSessionGeneration(): number {
  return sessionGeneration
}

export function clearLegacyAccessTokenStorage(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}

function clearAuthState() {
  cancelInFlightRefresh()
  accessToken = null
  sessionGeneration += 1
  acceptsRefreshedTokens = false
  if (typeof window !== "undefined") {
    localStorage.removeItem("sawaa_user")
    clearLegacyAccessTokenStorage()
  }
}

export function subscribeToAuthFailure(listener: () => void): () => void {
  authFailureListeners.add(listener)
  return () => authFailureListeners.delete(listener)
}

function notifyAuthFailure(): void {
  clearAuthState()
  for (const listener of authFailureListeners) listener()
}

/* ─── Initialise the shared client (browser only) ─── */

if (typeof window !== "undefined") {
  // Access tokens are memory-only. Clear legacy Web Storage tokens on bootstrap.
  clearLegacyAccessTokenStorage()

  initClient({
    baseUrl: PROXY_BASE_URL,
    getAccessToken: () => accessToken,
    onTokenRefreshed: (a) => {
      if (!acceptsRefreshedTokens) return
      setAccessToken(a)
      clearLegacyAccessTokenStorage()
    },
    onAuthFailure: () => {
      notifyAuthFailure()
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

  postBlob(endpoint: string, body?: unknown): Promise<Blob> {
    return requestBlob(endpoint, body)
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

  /** Submit multipart data; apiRequest lets the browser set its boundary. */
  postForm<T>(endpoint: string, form: FormData): Promise<T> {
    return apiRequest<T>(endpoint, {
      method: "POST",
      body: form,
    })
  },
}

async function requestBlob(
  endpoint: string,
  body?: unknown,
): Promise<Blob> {
  const generationAtRequest = sessionGeneration
  const blob = await apiBlobRequest(endpoint, {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  })
  if (generationAtRequest !== sessionGeneration) {
    throw new Error("Session changed during download")
  }
  return blob
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
