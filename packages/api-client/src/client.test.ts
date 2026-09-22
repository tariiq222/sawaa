import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  ORG_SUSPENDED_CODE,
  apiBlobRequest,
  apiRequest,
  cancelInFlightRefresh,
  ensureCsrfToken,
  initClient,
  setApiRequestBaseUrl,
} from './client'
import { setRefreshMutex, getRefreshMutex } from './refresh-mutex'

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
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

describe('apiBlobRequest response handling', () => {
  it('returns binary data through the shared 401 refresh path', async () => {
    storedAccess = 'old.access'
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { accessToken: 'new.access' } }),
      )
      .mockResolvedValueOnce(new Response('xlsx-bytes', { status: 200 }))

    const blob = await apiBlobRequest('/dashboard/ops/reports', {
      method: 'POST',
      body: JSON.stringify({ format: 'EXCEL' }),
    })

    expect(await blob.text()).toBe('xlsx-bytes')
    expect(storedAccess).toBe('new.access')
    expect(new Headers(vi.mocked(fetch).mock.calls[2]?.[1]?.headers).get('authorization'))
      .toBe('Bearer new.access')
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
    vi.stubGlobal('window', {})
    storedAccess = 'old.access'
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({}, 200, { 'X-CSRF-Token': 'a'.repeat(64) }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { accessToken: 'pub.access' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {} }))

    await apiRequest('/public/me/bookings')

    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toBe(
      'http://api.test/public/auth/refresh',
    )
  })

  it('bootstraps CSRF before public refresh and retries the original mutation unchanged', async () => {
    vi.stubGlobal('window', {})
    storedAccess = 'old.access'
    const body = JSON.stringify({ clientMessageId: 'message-1', text: 'hello' })
    const csrfToken = 'b'.repeat(64)
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({}, 200, { 'X-CSRF-Token': csrfToken }))
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { accessToken: 'new.access' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'message-1' } }))

    await expect(
      apiRequest('/public/me/chat/conversations/c1/messages', {
        method: 'POST',
        credentials: 'include',
        body,
      }),
    ).resolves.toEqual({ id: 'message-1' })

    const calls = vi.mocked(fetch).mock.calls
    expect(calls.map(([url]) => url)).toEqual([
      'http://api.test/public/branding',
      'http://api.test/public/me/chat/conversations/c1/messages',
      'http://api.test/public/auth/refresh',
      'http://api.test/public/me/chat/conversations/c1/messages',
    ])
    expect(calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'include' })
    expect(new Headers(calls[2]?.[1]?.headers).get('x-csrf-token')).toBe(csrfToken)
    expect(calls[3]?.[1]?.body).toBe(body)
    expect(new Headers(calls[3]?.[1]?.headers).get('authorization')).toBe('Bearer new.access')
  })

  it('rebootstraps and retries public refresh once when another tab made its CSRF token stale', async () => {
    vi.stubGlobal('window', {})
    storedAccess = 'old.access'
    const staleToken = 'a'.repeat(64)
    const freshToken = 'b'.repeat(64)
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({}, 200, { 'X-CSRF-Token': staleToken }))
      .mockResolvedValueOnce(
        jsonResponse(
          { statusCode: 403, code: 'CSRF_INVALID', message: 'CSRF token missing or invalid' },
          403,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({}, 200, { 'X-CSRF-Token': freshToken }))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { accessToken: 'new.access' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'booking-1' } }))

    await expect(apiRequest('/public/me/bookings/booking-1')).resolves.toEqual({ id: 'booking-1' })

    const calls = vi.mocked(fetch).mock.calls
    expect(calls.map(([url]) => url)).toEqual([
      'http://api.test/public/me/bookings/booking-1',
      'http://api.test/public/branding',
      'http://api.test/public/auth/refresh',
      'http://api.test/public/branding',
      'http://api.test/public/auth/refresh',
      'http://api.test/public/me/bookings/booking-1',
    ])
    expect(new Headers(calls[2]?.[1]?.headers).get('x-csrf-token')).toBe(staleToken)
    expect(new Headers(calls[4]?.[1]?.headers).get('x-csrf-token')).toBe(freshToken)
    expect(onAuthFailure).not.toHaveBeenCalled()
  })

  it('calls onAuthFailure only after the single CSRF refresh retry also fails', async () => {
    vi.stubGlobal('window', {})
    storedAccess = 'old.access'
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({}, 200, { 'X-CSRF-Token': 'a'.repeat(64) }))
      .mockResolvedValueOnce(
        jsonResponse({ statusCode: 403, code: 'CSRF_INVALID', message: 'CSRF token missing or invalid' }, 403),
      )
      .mockResolvedValueOnce(jsonResponse({}, 200, { 'X-CSRF-Token': 'b'.repeat(64) }))
      .mockResolvedValueOnce(
        jsonResponse({ statusCode: 403, code: 'CSRF_INVALID', message: 'CSRF token missing or invalid' }, 403),
      )

    await expect(apiRequest('/public/me/bookings/booking-1')).rejects.toMatchObject({
      status: 403,
      code: 'CSRF_INVALID',
    })

    expect(vi.mocked(fetch).mock.calls).toHaveLength(5)
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
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

  it('aborts an in-flight automatic refresh when the host invalidates the session', async () => {
    storedAccess = 'old.access'
    let refreshSignal: AbortSignal | undefined
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockImplementationOnce((_url, init) => {
        refreshSignal = init?.signal as AbortSignal | undefined
        return new Promise<Response>((_resolve, reject) => {
          refreshSignal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        })
      })

    const request = apiRequest('/dashboard/bookings/a')
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2))

    cancelInFlightRefresh()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(refreshSignal?.aborted).toBe(true)
    expect(onTokenRefreshed).not.toHaveBeenCalled()
  })

  it('lets one caller cancel its wait without aborting a shared refresh for another caller', async () => {
    storedAccess = 'old.access'
    const callerA = new AbortController()
    let refreshSignal: AbortSignal | undefined
    let resolveRefresh!: (response: Response) => void
    vi.mocked(fetch).mockImplementation((url, init) => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshSignal = init?.signal as AbortSignal | undefined
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve
        })
      }
      if (storedAccess === 'old.access') {
        return Promise.resolve(jsonResponse({ message: 'expired' }, 401))
      }
      return Promise.resolve(jsonResponse({ success: true, data: { id: String(url) } }))
    })

    const requestA = apiRequest('/dashboard/bookings/a', { signal: callerA.signal })
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2))
    const requestB = apiRequest<{ id: string }>('/dashboard/bookings/b')
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3))

    callerA.abort(new DOMException('caller cancelled', 'AbortError'))
    await expect(requestA).rejects.toMatchObject({ name: 'AbortError' })
    expect(refreshSignal?.aborted).toBe(false)

    resolveRefresh(jsonResponse({ accessToken: 'new.access' }))
    await expect(requestB).resolves.toEqual({ id: 'http://api.test/dashboard/bookings/b' })
    expect(onTokenRefreshed).toHaveBeenCalledWith('new.access')
    expect(
      vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh')),
    ).toHaveLength(1)
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

  it('preserves host auth state when refresh fails transiently', async () => {
    storedAccess = 'still-valid.access'
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired soon' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'temporary outage' }, 503))

    await expect(apiRequest('/dashboard/bookings/x')).rejects.toMatchObject({
      status: 503,
      message: 'temporary outage',
    })

    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(storedAccess).toBe('still-valid.access')
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

describe('apiRequest CSRF mismatch recovery', () => {
  it('replays once with the token echoed on the CSRF 403, without a second bootstrap GET', async () => {
    vi.stubGlobal('window', {})
    const staleToken = 'a'.repeat(64)
    const freshToken = 'b'.repeat(64)
    const body = JSON.stringify({ clientMessageId: 'message-1', text: 'hello' })
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({}, 200, { 'X-CSRF-Token': staleToken }))
      .mockResolvedValueOnce(
        jsonResponse(
          { statusCode: 403, code: 'CSRF_INVALID', message: 'CSRF token missing or invalid' },
          403,
          { 'X-CSRF-Token': freshToken },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'message-1' } }))

    const token = await ensureCsrfToken()
    await expect(
      apiRequest('/public/chat/conversations/c1/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': token },
        body,
      }),
    ).resolves.toEqual({ id: 'message-1' })

    const calls = vi.mocked(fetch).mock.calls
    expect(calls.map(([url]) => url)).toEqual([
      'http://api.test/public/branding',
      'http://api.test/public/chat/conversations/c1/messages',
      'http://api.test/public/chat/conversations/c1/messages',
    ])
    expect(calls[1]?.[1]?.body).toBe(body)
    expect(calls[2]?.[1]?.body).toBe(body)
    expect(new Headers(calls[2]?.[1]?.headers).get('x-csrf-token')).toBe(freshToken)
  })

  it('attaches CSRF on the first public login POST so the browser does not 403 first', async () => {
    vi.stubGlobal('window', {})
    const token = 'c'.repeat(64)
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({}, 200, { 'X-CSRF-Token': token }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { clientId: 'c1' } }))

    await expect(
      apiRequest('/public/auth/login', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ phone: '+966501234567', password: 'x' }),
      }),
    ).resolves.toEqual({ clientId: 'c1' })

    const calls = vi.mocked(fetch).mock.calls
    expect(calls.map(([url]) => url)).toEqual([
      'http://api.test/public/branding',
      'http://api.test/public/auth/login',
    ])
    expect(new Headers(calls[1]?.[1]?.headers).get('x-csrf-token')).toBe(token)
  })

  it('does not retry a second CSRF rejection', async () => {
    vi.stubGlobal('window', {})
    const staleToken = 'a'.repeat(64)
    const freshToken = 'b'.repeat(64)
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(
          { statusCode: 403, code: 'CSRF_INVALID', message: 'CSRF token missing or invalid' },
          403,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({}, 200, { 'X-CSRF-Token': freshToken }))
      .mockResolvedValueOnce(
        jsonResponse(
          { statusCode: 403, code: 'CSRF_INVALID', message: 'CSRF token missing or invalid' },
          403,
        ),
      )

    await expect(
      apiRequest('/public/chat/conversations/c1/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': staleToken },
        body: JSON.stringify({ clientMessageId: 'message-1', text: 'hello' }),
      }),
    ).rejects.toMatchObject({ status: 403, code: 'CSRF_INVALID' })

    expect(vi.mocked(fetch).mock.calls).toHaveLength(3)
  })

  it('fails closed for CSRF bootstrap outside a browser context', async () => {
    await expect(ensureCsrfToken()).rejects.toMatchObject({
      status: 0,
      code: 'CSRF_BROWSER_REQUIRED',
    })
    expect(fetch).not.toHaveBeenCalled()
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

  it('reads the machine code from the canonical top-level `code` field', async () => {
    // Canonical envelope: `error` holds the HTTP reason phrase, `code` holds the
    // machine code. The dashboard matches on `code` (e.g. DEPARTMENT_NAME_EXISTS).
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          statusCode: 409,
          error: 'Conflict',
          message: 'Department with this Arabic name already exists',
          code: 'DEPARTMENT_NAME_EXISTS',
        },
        409,
      ),
    )

    const err = await apiRequest('/dashboard/anything').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('DEPARTMENT_NAME_EXISTS')
    expect((err as ApiError).message).toBe(
      'Department with this Arabic name already exists',
    )
  })

  it('prefers top-level `code` over a string `error` reason phrase', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        { statusCode: 409, error: 'Conflict', message: 'dup', code: 'WINS' },
        409,
      ),
    )

    const err = await apiRequest('/dashboard/anything').catch((e) => e)
    expect((err as ApiError).code).toBe('WINS')
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
