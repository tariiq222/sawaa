import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  ORG_SUSPENDED_CODE,
  apiRequest,
  initClient,
  setApiRequestBaseUrl,
} from './client'
import { setRefreshMutex, getRefreshMutex } from './refresh-mutex'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function noContent(status = 204): Response {
  return new Response(null, { status })
}

let storedAccess = ''
let onTokenRefreshed = vi.fn()
let onAuthFailure = vi.fn()
let onOrgSuspended = vi.fn()

async function resetRefreshMutex(): Promise<void> {
  setRefreshMutex(Promise.resolve('reset'))
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  storedAccess = ''
  // Wire the vi.fn so we can assert against its calls; the side-effect
  // (updating storedAccess) lives inside the vi.fn implementation.
  onTokenRefreshed = vi.fn((a: string) => {
    storedAccess = a
  })
  onAuthFailure = vi.fn()
  onOrgSuspended = vi.fn()
  initClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => storedAccess,
    onTokenRefreshed,
    onAuthFailure,
    onOrgSuspended,
  })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await resetRefreshMutex()
})

// ─── Envelope unwrap + flat non-envelope ────────────────────────────────────

describe('apiRequest response unwrap', () => {
  it('unwraps a { success, data } envelope and returns the data payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'b1' } }),
    )

    const result = await apiRequest<{ id: string }>('/dashboard/bookings/b1')

    expect(result).toEqual({ id: 'b1' })
    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/dashboard/bookings/b1')
  })

  it('returns a flat (non-enveloped) JSON body as-is', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: 'flat' }))

    const result = await apiRequest<{ id: string }>('/public/some/raw/endpoint')

    expect(result).toEqual({ id: 'flat' })
  })

  it('returns undefined for HTTP 204 No Content responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(noContent(204))

    const result = await apiRequest<void>('/dashboard/anything', { method: 'DELETE' })

    expect(result).toBeUndefined()
  })
})

// ─── Multipart branch (FormData must NOT force JSON Content-Type) ───────────

describe('apiRequest body handling', () => {
  it('attaches Content-Type: application/json when no body provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(noContent(204))

    await apiRequest('/dashboard/anything', { method: 'POST' })

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('does NOT overwrite the multipart Content-Type when body is FormData', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { ok: true } }),
    )

    const fd = new FormData()
    fd.append('file', new Blob(['x']), 'a.txt')
    await apiRequest('/uploads', { method: 'POST', body: fd })

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    // Browser sets multipart/form-data;boundary=... — we must NOT have replaced
    // it with application/json.
    expect(headers['Content-Type']).toBeUndefined()
    expect(init?.body).toBe(fd)
  })

  it('attaches Authorization header when a token is present', async () => {
    storedAccess = 'jwt.access'
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true, data: {} }))

    await apiRequest('/dashboard/anything')

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer jwt.access')
  })

  it('omits Authorization when no token is present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true, data: {} }))

    await apiRequest('/dashboard/anything')

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })
})

// ─── 401 → refresh → retry flow ─────────────────────────────────────────────

describe('apiRequest 401 refresh flow', () => {
  it('refreshes and retries once when a non-auth endpoint returns 401', async () => {
    storedAccess = 'old.access'
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { accessToken: 'new.access' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'b1' } }))

    const result = await apiRequest<{ id: string }>('/dashboard/bookings/b1')

    expect(result).toEqual({ id: 'b1' })
    expect(storedAccess).toBe('new.access')
    expect(onTokenRefreshed).toHaveBeenCalledWith('new.access')
    expect(onAuthFailure).not.toHaveBeenCalled()

    const calls = vi.mocked(fetch).mock.calls
    expect(calls).toHaveLength(3)
    expect(calls[0]?.[0]).toBe('http://api.test/dashboard/bookings/b1')
    expect(calls[1]?.[0]).toBe('http://api.test/auth/refresh')
    expect(calls[2]?.[0]).toBe('http://api.test/dashboard/bookings/b1')

    // Retry call carries the new bearer token.
    const retryHeaders = calls[2]?.[1]?.headers as Record<string, string>
    expect(retryHeaders.Authorization).toBe('Bearer new.access')
    // Refresh uses credentials:include to send the httpOnly cookie.
    expect((calls[1]?.[1] as RequestInit).credentials).toBe('include')
  })

  it('uses /public/auth/refresh for public/* paths', async () => {
    storedAccess = 'old.access'
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { accessToken: 'pub.access' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {} }))

    await apiRequest('/public/me/bookings')

    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe(
      'http://api.test/public/auth/refresh',
    )
  })

  it('shares a single refresh across concurrent 401s (mutex)', async () => {
    storedAccess = 'old.access'
    // First request → 401 (triggers refresh)
    // Second request → 401 (must reuse the in-flight refresh, not start a new one)
    // Then refresh resolves with new.access, both retries succeed.
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { accessToken: 'new.access' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'a' } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'b' } }))

    const [r1, r2] = await Promise.all([
      apiRequest<{ id: string }>('/dashboard/bookings/a'),
      apiRequest<{ id: string }>('/dashboard/bookings/b'),
    ])

    expect(r1).toEqual({ id: 'a' })
    expect(r2).toEqual({ id: 'b' })

    // Only ONE refresh call should have been made, even with two concurrent 401s.
    const calls = vi.mocked(fetch).mock.calls
    const refreshCalls = calls.filter((c) =>
      String(c[0]).endsWith('/auth/refresh'),
    )
    expect(refreshCalls).toHaveLength(1)
  })

  it('fires onAuthFailure and rejects with an ApiError when the refresh itself returns non-2xx', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'refresh invalid' }, 401))

    const err = await apiRequest('/dashboard/bookings/x').catch((e) => e)
    // The refresh-endpoint failure is now surfaced as an ApiError so callers
    // that branch on `err instanceof ApiError` (e.g. to show a 401 toast or
    // route to a login screen) hit the auth-failure code path instead of
    // being skipped by a plain Error. onAuthFailure still fires.
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      status: 401,
      message: 'refresh invalid',
      code: 'refresh invalid',
    })
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(onTokenRefreshed).not.toHaveBeenCalled()
  })

  it('does NOT refresh on 401 for auth endpoints (/auth/login bad creds)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ message: 'Bad credentials' }, 401),
    )

    await expect(apiRequest('/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
      message: 'Bad credentials',
    })

    // Only one fetch — no refresh attempt.
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1)
    expect(onAuthFailure).not.toHaveBeenCalled()
  })

  it('does NOT refresh on 401 for /auth/refresh or /auth/logout', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ message: 'revoked' }, 401),
    )

    await expect(apiRequest('/auth/refresh', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    })
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1)

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ message: 'no session' }, 401),
    )

    await expect(apiRequest('/auth/logout', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    })
    expect(vi.mocked(fetch).mock.calls).toHaveLength(2)
  })
})

// ─── ORG_SUSPENDED branch (skips refresh loop) ──────────────────────────────

describe('apiRequest ORG_SUSPENDED', () => {
  it('skips refresh and fires onOrgSuspended when 401 body has ORG_SUSPENDED code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          message: { error: ORG_SUSPENDED_CODE, message: 'org suspended' },
        },
        401,
      ),
    )

    await expect(apiRequest('/dashboard/bookings')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: ORG_SUSPENDED_CODE,
      message: 'org suspended',
    })

    expect(onOrgSuspended).toHaveBeenCalledTimes(1)
    expect(onAuthFailure).not.toHaveBeenCalled()
    // Only one fetch — no refresh attempt.
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1)
  })
})

// ─── peekErrorBody — 4 NestJS shapes ────────────────────────────────────────

describe('ApiError + peekErrorBody precedence', () => {
  it('decodes nested { message: { error, message } } (custom conflict shape)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        { message: { error: 'SLOT_TAKEN', message: 'Slot already booked' } },
        409,
      ),
    )

    const err = await apiRequest('/dashboard/bookings').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      status: 409,
      code: 'SLOT_TAKEN',
      message: 'Slot already booked',
    })
  })

  it('decodes { error: { code, message } } (legacy envelope shape)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Bad creds' } },
        401,
      ),
    )

    const err = await apiRequest('/auth/login', { method: 'POST' }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Bad creds',
    })
  })

  it('decodes validation { message: string[] } by joining the array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          statusCode: 400,
          message: ['email must be an email', 'name should not be empty'],
          error: 'Bad Request',
        },
        400,
      ),
    )

    const err = await apiRequest('/dashboard/anything').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 400 })
    // code falls back to body.error (string)
    expect((err as ApiError).code).toBe('Bad Request')
    expect((err as ApiError).message).toBe(
      'email must be an email, name should not be empty',
    )
  })

  it('decodes the legacy flat { error: string, message: string } envelope', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'CONFLICT', message: 'duplicate' }, 409),
    )

    const err = await apiRequest('/dashboard/anything').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'duplicate',
    })
  })

  it('falls back to UNKNOWN code and statusText when the body is empty', async () => {
    // 404 with no JSON body — peekErrorBody swallows the JSON parse failure.
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 404, statusText: 'Not Found' }),
    )

    const err = await apiRequest('/dashboard/missing').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 404, code: 'UNKNOWN', message: 'Not Found' })
  })

  it('prefers nested message.error over error.code (precedence)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          message: { error: 'NESTED_WINS', message: 'nested message' },
          error: { code: 'OUTER_LOSES', message: 'outer message' },
        },
        422,
      ),
    )

    const err = await apiRequest('/dashboard/anything').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('NESTED_WINS')
    expect((err as ApiError).message).toBe('nested message')
  })

  it('ApiError extends Error and exposes status + code + body', () => {
    const body = { reason: 'boom' }
    const err = new ApiError(418, 'teapot', body, 'IM_A_TEAPOT')

    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.name).toBe('ApiError')
    expect(err.status).toBe(418)
    expect(err.code).toBe('IM_A_TEAPOT')
    expect(err.message).toBe('teapot')
    expect(err.body).toBe(body)
  })
})

// ─── setApiRequestBaseUrl init vs overwrite ────────────────────────────────

describe('setApiRequestBaseUrl', () => {
  it('overwrites the baseUrl of an already-initialized client', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true, data: {} }))

    setApiRequestBaseUrl('http://api.test/v2')
    await apiRequest('/anything')

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('http://api.test/v2/anything')
  })

  it('preserves the rest of the config (token getter, callbacks) on overwrite', async () => {
    storedAccess = 'preserved.token'
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true, data: {} }))

    setApiRequestBaseUrl('http://api.test/v2')
    await apiRequest('/anything')

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer preserved.token')
  })
})

// ─── Not-initialized guard ─────────────────────────────────────────────────

describe('apiRequest before initClient', () => {
  it('initializes a bare-bones config when setApiRequestBaseUrl is called before initClient', async () => {
    // Force a fresh module load so the module-level `config` is null again.
    vi.resetModules()
    // The `?bare-config` query suffix disambiguates the import so vitest does
    // not hand back the cached module from other tests in this file.
    const fresh = (await import(`./client?bare-config=${Date.now()}`)) as typeof import('./client')

    fresh.setApiRequestBaseUrl('http://bare.test')

    // After the bare-config path runs, apiRequest must work end-to-end:
    //   - it has a baseUrl (the one we just set)
    //   - no token attached (getAccessToken returns null)
    //   - no-op callbacks (must not throw)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ id: 'bare' })),
    )
    try {
      const result = await fresh.apiRequest('/anything')
      expect(result).toEqual({ id: 'bare' })
      const [url, init] = vi.mocked(fetch).mock.calls[0]!
      expect(url).toBe('http://bare.test/anything')
      const headers = init?.headers as Record<string, string>
      expect(headers.Authorization).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('mutex can be queried and set without throwing', () => {
    expect(getRefreshMutex()).toBeNull()
    setRefreshMutex(Promise.resolve('ok'))
    expect(getRefreshMutex()).not.toBeNull()
  })
})
