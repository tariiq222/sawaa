import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initClient } from '../../client'
import * as authApi from '../auth'
import type { AuthResponse, UserPayload } from '../../types/auth'

const fakeAccess = 'access.jwt'
const fakeRefresh = 'refresh.jwt'

const fakeUser: UserPayload = {
  id: 'usr_1',
  email: 'admin@sawaa.app',
  name: 'Admin Owner',
  firstName: 'Admin',
  lastName: 'Owner',
  phone: null,
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: 'OWNER',
  customRoleId: null,
  isSuperAdmin: false,
  permissions: ['booking:read'],
  onboardingCompletedAt: null,
}

const fakeAuth: AuthResponse = {
  accessToken: fakeAccess,
  refreshToken: fakeRefresh,
  expiresIn: 900,
  user: fakeUser,
}

let storedAccess: string | null = null
let onAuthFailure = vi.fn()

beforeEach(() => {
  storedAccess = null
  onAuthFailure = vi.fn()
  initClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => storedAccess,
    // CR-9: getRefreshToken is deprecated; refresh token is now httpOnly cookie
    onTokenRefreshed: (a) => {
      storedAccess = a
    },
    onAuthFailure,
  })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('authApi.login', () => {
  it('POSTs /auth/login with email+password and unwraps {success,data} envelope', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: fakeAuth }),
    )

    const result = await authApi.login({
      email: 'admin@sawaa.app',
      password: 'pw',
      
    })

    expect(result).toEqual(fakeAuth)

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/auth/login')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'admin@sawaa.app',
      password: 'pw',
      
    })
  })

  it('also accepts a flat (non-enveloped) response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJsonResponse(fakeAuth))

    const result = await authApi.login({
      email: 'a@b.c',
      password: 'pw',
      
    })

    expect(result).toEqual(fakeAuth)
  })

  it('throws ApiError with status + message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ message: 'Bad credentials' }, 401),
    )

    await expect(
      authApi.login({ email: 'a@b.c', password: 'wrong' }),
    ).rejects.toMatchObject({ status: 401, message: 'Bad credentials' })
  })
})

describe('authApi.refreshToken', () => {
  it('POSTs /auth/refresh with empty body (CR-9: token is httpOnly cookie) and returns a TokenPair', async () => {
    const fakeTokenPair = {
      accessToken: 'new.access',
      expiresIn: 900,
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: fakeTokenPair }),
    )

    const result = await authApi.refreshToken()

    expect(result.accessToken).toBe('new.access')
    expect(result.expiresIn).toBe(900)
    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.credentials).toBe('include')
    // CR-9: no refresh token in body — it's sent automatically as httpOnly cookie
    expect(JSON.parse(init?.body as string)).toEqual({})
  })
})

describe('authApi.getMe', () => {
  it('GETs /auth/me with bearer token from getAccessToken()', async () => {
    storedAccess = fakeAccess
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: fakeUser }),
    )

    const me = await authApi.getMe()

    expect(me).toEqual(fakeUser)
    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${fakeAccess}`)
  })
})

describe('authApi.logout', () => {
  it('POSTs /auth/logout (no body required)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await authApi.logout()

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/auth/logout')
    expect(init?.method).toBe('POST')
  })
})

describe('authApi.changePassword', () => {
  it('PATCHes /auth/password/change with current+new password', async () => {
    storedAccess = fakeAccess
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await authApi.changePassword({
      currentPassword: 'old',
      newPassword: 'new',
    })

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/auth/password/change')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      currentPassword: 'old',
      newPassword: 'new',
    })
  })
})

describe('authApi.requestStaffPasswordReset', () => {
  it('POSTs /auth/request-password-reset with the email and returns void', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await authApi.requestStaffPasswordReset('staff@sawaa.app')

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/auth/request-password-reset')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ email: 'staff@sawaa.app' })
  })

  it('throws ApiError on 4xx with the parsed code/message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
        429,
      ),
    )

    await expect(
      authApi.requestStaffPasswordReset('staff@sawaa.app'),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests',
    })
  })
})

describe('authApi.performStaffPasswordReset', () => {
  it('POSTs /auth/reset-password with token+newPassword and returns void', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await authApi.performStaffPasswordReset('reset.tok', 'newPassword!1')

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/auth/reset-password')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      token: 'reset.tok',
      newPassword: 'newPassword!1',
    })
  })

  it('throws ApiError with INVALID_TOKEN on bad reset token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse(
        { message: { error: 'INVALID_TOKEN', message: 'Token expired' } },
        400,
      ),
    )

    await expect(
      authApi.performStaffPasswordReset('expired.tok', 'x'),
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_TOKEN',
      message: 'Token expired',
    })
  })
})

describe('authApi.requestDashboardOtp', () => {
  it('POSTs /auth/otp/request-dashboard with email and unwraps the masked identifier response', async () => {
    const otpResponse = { maskedIdentifier: 'a***@sawaa.app', expiresInSeconds: 300 }
    storedAccess = fakeAccess
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: otpResponse }),
    )

    const result = await authApi.requestDashboardOtp({ email: 'admin@sawaa.app' })

    expect(result).toEqual(otpResponse)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/auth/otp/request-dashboard')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ email: 'admin@sawaa.app' })
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${fakeAccess}`)
  })

  it('throws ApiError when the OTP rate limit fires', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ error: 'OTP_RATE_LIMIT', message: 'Try later' }, 429),
    )

    await expect(
      authApi.requestDashboardOtp({ email: 'admin@sawaa.app' }),
    ).rejects.toMatchObject({
      status: 429,
      code: 'OTP_RATE_LIMIT',
    })
  })
})

describe('authApi.verifyDashboardOtp', () => {
  it('POSTs /auth/otp/verify-dashboard with email+code and returns AuthResponse', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: fakeAuth }),
    )

    const result = await authApi.verifyDashboardOtp({
      email: 'admin@sawaa.app',
      code: '123456',
    })

    expect(result).toEqual(fakeAuth)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/auth/otp/verify-dashboard')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'admin@sawaa.app',
      code: '123456',
    })
  })

  it('throws ApiError on wrong code with the parsed code', async () => {
    // Wrong code is a validation problem (422), not an expired session —
    // we deliberately avoid 401 here because /auth/otp/verify-dashboard is
    // NOT in AUTH_ENDPOINTS_NO_RETRY, so a 401 would trigger refresh.
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse(
        { message: { error: 'INVALID_OTP', message: 'Wrong code' } },
        422,
      ),
    )

    await expect(
      authApi.verifyDashboardOtp({ email: 'admin@sawaa.app', code: '000000' }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_OTP',
      message: 'Wrong code',
    })
  })
})

describe('authApi.lookupUser', () => {
  it('POSTs /auth/lookup with the identifier field and unwraps the envelope', async () => {
    const lookupResp = { exists: true, emailVerificationRequired: false }
    storedAccess = fakeAccess
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: lookupResp }),
    )

    const result = await authApi.lookupUser({ identifier: 'admin@sawaa.app' })

    expect(result).toEqual(lookupResp)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/auth/lookup')
    expect(init?.method).toBe('POST')
    // CRITICAL: the wire field is `identifier`, NOT `email` — guards against
    // silent field-renames that would break the backend lookup.
    expect(JSON.parse(init?.body as string)).toEqual({
      identifier: 'admin@sawaa.app',
    })
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${fakeAccess}`)
  })

  it('returns exists=false without throwing when the identifier is unknown', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({
        success: true,
        data: { exists: false, emailVerificationRequired: false },
      }),
    )

    const result = await authApi.lookupUser({ identifier: 'unknown@sawaa.app' })

    expect(result).toEqual({ exists: false, emailVerificationRequired: false })
  })

  it('throws ApiError when the lookup endpoint is unavailable', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ error: 'SERVICE_DOWN', message: 'Try later' }, 503),
    )

    await expect(
      authApi.lookupUser({ identifier: 'admin@sawaa.app' }),
    ).rejects.toMatchObject({ status: 503, code: 'SERVICE_DOWN' })
  })
})
