import { getRefreshMutex, setRefreshMutex } from './refresh-mutex'

// Backend signals organization suspension via 401 + this code in the error body.
// When detected, callers should clear local auth and redirect to root —
// the refresh-token loop is intentionally skipped (refreshing a suspended
// organization just bounces back the same 401).
export const ORG_SUSPENDED_CODE = 'ORG_SUSPENDED'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const CSRF_TOKEN_PATTERN = /^[a-f0-9]{64}$/i
const CSRF_INVALID_CODE = 'CSRF_INVALID'
const DEFAULT_CSRF_BOOTSTRAP_PATH = '/public/branding'

export interface ClientConfig {
  baseUrl: string
  getAccessToken: () => string | null
  /** @deprecated CR-9: refresh token is now an httpOnly cookie; this callback is no longer invoked */
  getRefreshToken?: () => string | null
  onTokenRefreshed: (accessToken: string) => void
  onAuthFailure: () => void
  // Optional callback fired when the backend returns 401 + ORG_SUSPENDED.
  // Hosts (dashboard) typically clear local auth state and full-reload to
  // surface a banner. Admin app passes a no-op since suspension UX differs.
  onOrgSuspended?: () => void
}

let config: ClientConfig | null = null
let csrfToken: string | null = null
let csrfBootstrap: Promise<string> | null = null

export function initClient(cfg: ClientConfig): void {
  config = cfg
  resetCsrfState()
}

export function setApiRequestBaseUrl(baseUrl: string): void {
  if (!config || config.baseUrl !== baseUrl) resetCsrfState()
  config = config
    ? { ...config, baseUrl }
    : {
        baseUrl,
        getAccessToken: () => null,
        onTokenRefreshed: () => undefined,
        onAuthFailure: () => undefined,
      }
}

/**
 * Acquire the double-submit token from an API response header. This works when
 * the browser app and API are on different origins and the API cookie is
 * intentionally host-only, so `document.cookie` cannot read it.
 */
export function ensureCsrfToken(
  bootstrapPath = DEFAULT_CSRF_BOOTSTRAP_PATH,
): Promise<string> {
  // Server rendering has no browser cookie jar. Fail closed instead of
  // attempting a double-submit mutation without a cookie-bound proof.
  if (typeof window === 'undefined') {
    return Promise.reject(
      new ApiError(
        0,
        'CSRF-protected mutations require a browser context',
        undefined,
        'CSRF_BROWSER_REQUIRED',
      ),
    )
  }
  if (csrfToken) return Promise.resolve(csrfToken)
  if (csrfBootstrap) return csrfBootstrap
  csrfBootstrap = bootstrapCsrfToken(bootstrapPath).finally(() => {
    csrfBootstrap = null
  })
  return csrfBootstrap
}

async function bootstrapCsrfToken(path: string): Promise<string> {
  if (!config) throw new Error('api-client not initialized')
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  captureCsrfToken(res)
  if (!csrfToken) {
    throw new ApiError(
      res.status,
      'CSRF token bootstrap failed',
      undefined,
      'CSRF_BOOTSTRAP_FAILED',
    )
  }
  return csrfToken
}

function captureCsrfToken(response: Response): void {
  const candidate = response.headers.get(CSRF_HEADER_NAME)
  if (candidate && CSRF_TOKEN_PATTERN.test(candidate)) csrfToken = candidate
}

function resetCsrfState(): void {
  csrfToken = null
  csrfBootstrap = null
}

function invalidateCsrfToken(): void {
  // Retain an in-flight bootstrap so concurrent stale requests converge on
  // one safe GET rather than creating another local race.
  csrfToken = null
}

async function doRefresh(refreshPath: string): Promise<string> {
  if (!config) throw new Error('api-client not initialized')
  // CR-9: refresh token is an httpOnly cookie (ck_refresh); credentials: 'include'
  // sends it automatically. No token in body — empty object for compatibility.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (refreshPath.startsWith('/public/')) {
    // Public refresh relies on the client-session cookie and is CSRF-protected.
    setHeader(headers, CSRF_HEADER_NAME, await ensureCsrfToken())
  }
  const res = await fetch(`${config.baseUrl}${refreshPath}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({}),
  })
  captureCsrfToken(res)
  if (!res.ok) {
    config.onAuthFailure()
    const peek = await peekErrorBody(res)
    throw new ApiError(res.status, peek.message, peek.body, peek.code)
  }
  const raw = (await res.json()) as unknown
  const data =
    raw && typeof raw === 'object' && 'success' in raw && 'data' in raw
      ? ((raw as { data: { accessToken: string } }).data)
      : (raw as { accessToken: string })
  if (typeof data.accessToken === 'string') {
    config.onTokenRefreshed(data.accessToken)
    return data.accessToken
  }
  return ''
}

// Auth endpoints must NEVER trigger the 401-refresh flow:
// - /auth/login: a 401 means bad credentials, not an expired session
// - /auth/refresh: refresh failure should surface directly, not loop
// - /auth/logout: 401 here is meaningless and would mask the original error
const AUTH_ENDPOINTS_NO_RETRY = ['/auth/login', '/auth/refresh', '/auth/logout']

function isAuthEndpoint(path: string): boolean {
  return AUTH_ENDPOINTS_NO_RETRY.some((suffix) => path.endsWith(suffix))
}

function getRefreshPath(path: string): string {
  return path.startsWith('/public/') ? '/public/auth/refresh' : '/auth/refresh'
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
  csrfRetried = false,
): Promise<T> {
  if (!config) throw new Error('api-client not initialized')

  const token = config.getAccessToken()
  // FormData (multipart) MUST set its own Content-Type with the boundary —
  // omit the JSON CT we'd otherwise default to.
  const isMultipart =
    typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers = toHeaderRecord(options.headers)
  if (!isMultipart && !hasHeader(headers, 'Content-Type')) {
    setHeader(headers, 'Content-Type', 'application/json')
  }
  if (token) setHeader(headers, 'Authorization', `Bearer ${token}`)

  const res = await fetch(`${config.baseUrl}${path}`, { ...options, headers })
  captureCsrfToken(res)

  if (res.status === 401 && !retried && !isAuthEndpoint(path)) {
    // Organization-suspended responses must NOT trigger the refresh loop —
    // the refresh would just produce another 401. Surface immediately
    // and let the host (dashboard) clear local state + redirect.
    const peek = await peekErrorBody(res)
    if (peek.code === ORG_SUSPENDED_CODE) {
      config.onOrgSuspended?.()
      throw new ApiError(401, peek.message, peek.body, ORG_SUSPENDED_CODE)
    }

    let mutex = getRefreshMutex()
    if (!mutex) {
      mutex = doRefresh(getRefreshPath(path))
      // setRefreshMutex attaches the unhandled-rejection sentinel — see
      // refresh-mutex.ts. Awaiters of `mutex` below still observe the
      // original rejection.
      setRefreshMutex(mutex)
    }
    await mutex
    return apiRequest<T>(path, options, true, csrfRetried)
  }

  if (!res.ok) {
    const peek = await peekErrorBody(res)
    if (
      peek.code === CSRF_INVALID_CODE &&
      !csrfRetried &&
      isUnsafeMethod(options.method) &&
      isReplayableBody(options.body)
    ) {
      // CSRF rejects before the controller, so one exact-body replay after a
      // fresh safe GET cannot duplicate a mutation. A second 403 is surfaced.
      invalidateCsrfToken()
      const freshToken = await ensureCsrfToken()
      return apiRequest<T>(path, withCsrfHeader(options, freshToken), retried, true)
    }
    throw new ApiError(res.status, peek.message, peek.body, peek.code)
  }

  if (res.status === 204) return undefined as T
  const json = (await res.json()) as unknown
  // Backend wraps every response as { success: true, data: T }.
  // Unwrap transparently so callers receive the raw T.
  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in json
  ) {
    return (json as { data: T }).data
  }
  return json as T
}

function toHeaderRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return { ...headers }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase())
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
  const existing = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase())
  if (existing && existing !== name) delete headers[existing]
  headers[name] = value
}

function withCsrfHeader(options: RequestInit, token: string): RequestInit {
  const headers = toHeaderRecord(options.headers)
  setHeader(headers, CSRF_HEADER_NAME, token)
  return { ...options, headers }
}

function isUnsafeMethod(method: string | undefined): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase())
}

function isReplayableBody(body: BodyInit | null | undefined): boolean {
  if (body == null || typeof body === 'string') return true
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true
  if (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) {
    return true
  }
  return false
}

interface PeekedError {
  body: unknown
  code: string
  message: string
}

// Handle the NestJS error shapes the backend emits:
//   { statusCode, error, message, code }                ← canonical envelope (code = machine code)
//   { statusCode, message, error: string }              ← default
//   { statusCode, message: string[], error }            ← validation
//   { statusCode, message: { error, message }, error }  ← legacy custom conflict
//   { error: { code, message } }                        ← legacy nested envelope
// `error` always carries the HTTP reason phrase; the machine code lives in the
// dedicated top-level `code` field, so it takes precedence when present.
async function peekErrorBody(res: Response): Promise<PeekedError> {
  const body = (await res
    .clone()
    .json()
    .catch(() => ({}))) as Record<string, unknown>
  const nestedMessage =
    body && typeof body.message === 'object' && body.message !== null && !Array.isArray(body.message)
      ? (body.message as { error?: string; message?: string })
      : null
  const errorObj =
    body && typeof body.error === 'object' && body.error !== null
      ? (body.error as { code?: string; message?: string })
      : null
  const code: string =
    (typeof body.code === 'string' ? (body.code as string) : undefined) ??
    nestedMessage?.error ??
    errorObj?.code ??
    (typeof body.error === 'string' ? (body.error as string) : undefined) ??
    (typeof body.message === 'string' ? (body.message as string) : undefined) ??
    'UNKNOWN'
  const rawMessage =
    nestedMessage?.message ??
    errorObj?.message ??
    (Array.isArray(body.message) ? (body.message as string[]).join(', ') : (body.message as string | undefined))
  const message = rawMessage ?? res.statusText
  return { body, code, message }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
    public readonly code: string = 'UNKNOWN',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
