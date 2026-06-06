import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initClient } from '../../client'
import {
  setClientBaseUrl,
  initClientAuth,
  clientLogin,
  clientRegister,
  clientLogout,
  clientResetPassword,
} from '../client-auth'

const fakeAuth = {
  accessToken: 'a.t',
  refreshToken: 'r.t',
  clientId: 'cl_1',
}

let storedRefresh: string | null = null

beforeEach(() => {
  storedRefresh = null
  initClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => null,
    onTokenRefreshed: vi.fn(),
    onAuthFailure: vi.fn(),
  })
  setClientBaseUrl('http://api.test')
  initClientAuth({ getRefreshToken: () => storedRefresh })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('clientLogin', () => {
  it('POSTs /public/auth/login and unwraps the envelope', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: true, data: fakeAuth }),
    )

    const result = await clientLogin({
      email: 'a@b.c',
      password: 'pw',
    })

    expect(result).toEqual(fakeAuth)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/public/auth/login')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'a@b.c',
      password: 'pw',
    })
    expect((init as RequestInit).credentials).toBe('include')
  })

  it('throws ApiError with central status, body, and code on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'INVALID_CREDENTIALS', message: 'Bad creds' }, 401),
    )
    await expect(
      clientLogin({ email: 'a@b.c', password: 'wrong' }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'INVALID_CREDENTIALS',
      body: { error: 'INVALID_CREDENTIALS', message: 'Bad creds' },
      message: 'Bad creds',
    })
  })
})

describe('clientRegister', () => {
  it('POSTs /public/auth/register with otpSessionToken bearer + password+name body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: true, data: fakeAuth }),
    )

    await clientRegister({
      otpSessionToken: 'otp.session',
      password: 'pw',
      name: 'Alice',

    })

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/public/auth/register')
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer otp.session')
    expect(JSON.parse(init?.body as string)).toEqual({
      password: 'pw',
      name: 'Alice',
    })
  })
})

describe('clientLogout', () => {
  it('POSTs /public/auth/logout with credentials included (cookie-based refresh)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await clientLogout()

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/public/auth/logout')
    expect(JSON.parse(init?.body as string)).toEqual({})
    expect((init as RequestInit).credentials).toBe('include')
  })
})

describe('clientResetPassword', () => {
  it('POSTs /public/auth/reset-password with sessionToken + newPassword', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await clientResetPassword({
      sessionToken: 'reset.tok',
      newPassword: 'newPw',
    })

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/public/auth/reset-password')
    expect(JSON.parse(init?.body as string)).toEqual({
      sessionToken: 'reset.tok',
      newPassword: 'newPw',
    })
  })
})
