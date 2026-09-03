/**
 * AuthProvider — unit tests
 *
 * Covers:
 *  - Login: sets user + schedules refresh + persists to localStorage
 *  - Logout: clears user + localStorage + cancels refresh timer
 *  - Session restore on mount: refreshToken → fetchMe → user state
 *  - Session expired on mount: refresh fails → user null
 *  - canDo() permission checking
 *  - isAuthenticated flag
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/components/providers/auth-provider'

// ---------------------------------------------------------------------------
// Mock lib/api/auth so no real network calls are made
// ---------------------------------------------------------------------------

const mockLogin = vi.fn()
const mockLogoutApi = vi.fn()
const mockFetchMe = vi.fn()
const mockRefreshToken = vi.fn()
const mockAcceptAuthResponse = vi.fn()
const mockSetAccessToken = vi.fn()
const mockSubscribeToAuthFailure = vi.fn()
let authFailureHandler: (() => void) | undefined

vi.mock('@/lib/api/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  acceptAuthResponse: (...args: unknown[]) => mockAcceptAuthResponse(...args),
  logoutApi: (...args: unknown[]) => mockLogoutApi(...args),
  fetchMe: (...args: unknown[]) => mockFetchMe(...args),
  refreshToken: (...args: unknown[]) => mockRefreshToken(...args),
}))

vi.mock('@/lib/api', () => ({
  setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
  getAccessToken: vi.fn(() => null),
  getSessionGeneration: vi.fn(() => 0),
  subscribeToAuthFailure: (listener: () => void) => {
    authFailureHandler = listener
    mockSubscribeToAuthFailure(listener)
    return () => {
      if (authFailureHandler === listener) authFailureHandler = undefined
    }
  },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  email: 'admin@sawaa-test.com',
  firstName: 'Admin',
  lastName: 'User',
  phone: null,
  gender: null,
  roles: [{ id: 'r1', name: 'Admin', slug: 'admin' }],
  permissions: ['bookings:read', 'bookings:write', 'clients:*'],
}

const mockAuthResponse = {
  user: mockUser,
  accessToken: 'mock-access-token',
  expiresIn: 900,
}

// ---------------------------------------------------------------------------
// Helper: render a consumer component inside AuthProvider
// ---------------------------------------------------------------------------

function TestConsumer() {
  const { user, loading, isAuthenticated, canDo, login, logout } = useAuth()
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{user ? user.email : 'none'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="can-bookings-read">{canDo('bookings', 'read') ? 'yes' : 'no'}</div>
      <div data-testid="can-invoices-delete">{canDo('invoices', 'delete') ? 'yes' : 'no'}</div>
      <div data-testid="can-clients-anything">{canDo('clients', 'anything') ? 'yes' : 'no'}</div>
      <button onClick={() => login('test@test.com', 'Pass123!')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  )
}

function renderWithProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return { ...result, queryClient }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthProvider', () => {
  beforeEach(() => {
    mockLogin.mockReset()
    mockLogoutApi.mockReset()
    mockFetchMe.mockReset()
    mockRefreshToken.mockReset()
    mockAcceptAuthResponse.mockReset()
    mockAcceptAuthResponse.mockReturnValue(true)
    mockSetAccessToken.mockReset()
    mockSubscribeToAuthFailure.mockReset()
    authFailureHandler = undefined
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // Session restore on mount
  // =========================================================================

  describe('session restore on mount', () => {
    it('should set user when refresh + fetchMe succeed', async () => {
      mockRefreshToken.mockResolvedValue(mockAuthResponse)
      mockFetchMe.mockResolvedValue(mockUser)

      renderWithProvider()

      expect(screen.getByTestId('loading').textContent).toBe('loading')

      await waitFor(() =>
        expect(screen.getByTestId('loading').textContent).toBe('ready'),
      )

      expect(screen.getByTestId('user').textContent).toBe(mockUser.email)
      expect(screen.getByTestId('authenticated').textContent).toBe('yes')
      expect(mockSetAccessToken).toHaveBeenCalledWith(mockAuthResponse.accessToken)
    })

    it('should set user null when refresh fails (expired session)', async () => {
      mockRefreshToken.mockRejectedValue(new Error('Session expired'))

      renderWithProvider()

      await waitFor(() =>
        expect(screen.getByTestId('loading').textContent).toBe('ready'),
      )

      expect(screen.getByTestId('user').textContent).toBe('none')
      expect(screen.getByTestId('authenticated').textContent).toBe('no')
    })

    it('should remove sawaa_user from localStorage on failed restore', async () => {
      localStorage.setItem('sawaa_user', JSON.stringify(mockUser))
      mockRefreshToken.mockRejectedValue(new Error('expired'))

      renderWithProvider()

      await waitFor(() =>
        expect(screen.getByTestId('loading').textContent).toBe('ready'),
      )

      expect(localStorage.getItem('sawaa_user')).toBeNull()
    })

    it('keeps the active restore when StrictMode aborts the first effect', async () => {
      let firstSignal: AbortSignal | undefined
      let secondSignal: AbortSignal | undefined
      mockRefreshToken
        .mockImplementationOnce((signal?: AbortSignal) => {
          firstSignal = signal
          return new Promise((_, reject) => {
            signal?.addEventListener('abort', () => reject(new Error('aborted')))
          })
        })
        .mockImplementationOnce((signal?: AbortSignal) => {
          secondSignal = signal
          return Promise.resolve(mockAuthResponse)
        })
      mockFetchMe.mockResolvedValue(mockUser)

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      render(
        <React.StrictMode>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <TestConsumer />
            </AuthProvider>
          </QueryClientProvider>
        </React.StrictMode>,
      )

      await waitFor(() => expect(mockRefreshToken).toHaveBeenCalledTimes(2))
      expect(firstSignal?.aborted).toBe(true)
      expect(secondSignal?.aborted).toBe(false)
      await waitFor(() =>
        expect(screen.getByTestId('user').textContent).toBe(mockUser.email),
      )
    })
  })

  // =========================================================================
  // Login
  // =========================================================================

  describe('login()', () => {
    it('should set user and isAuthenticated after successful login', async () => {
      // Start with no session
      mockRefreshToken.mockRejectedValue(new Error('no session'))
      mockLogin.mockResolvedValue(mockAuthResponse)

      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('loading').textContent).toBe('ready'),
      )

      await act(async () => {
        await userEvent.click(screen.getByText('Login'))
      })

      expect(screen.getByTestId('user').textContent).toBe(mockUser.email)
      expect(screen.getByTestId('authenticated').textContent).toBe('yes')
      expect(mockAcceptAuthResponse).toHaveBeenCalledWith(mockAuthResponse, 0)
    })

    it('should call apiLogin with correct credentials', async () => {
      mockRefreshToken.mockRejectedValue(new Error('no session'))
      mockLogin.mockResolvedValue(mockAuthResponse)

      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('loading').textContent).toBe('ready'),
      )

      await act(async () => {
        await userEvent.click(screen.getByText('Login'))
      })

      expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'Pass123!')
    })

    it('does not accept a login response that resolves after the session was cleared', async () => {
      mockRefreshToken.mockRejectedValue(new Error('no session'))
      const lateLogin = deferred<typeof mockAuthResponse>()
      mockLogin.mockReturnValue(lateLogin.promise)

      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('loading').textContent).toBe('ready'),
      )

      act(() => screen.getByText('Login').click())
      await waitFor(() => expect(mockLogin).toHaveBeenCalledOnce())
      act(() => authFailureHandler?.())
      await act(async () => {
        lateLogin.resolve(mockAuthResponse)
        await Promise.resolve()
      })

      expect(mockSetAccessToken).not.toHaveBeenCalledWith(mockAuthResponse.accessToken)
      expect(mockAcceptAuthResponse).not.toHaveBeenCalledWith(mockAuthResponse)
      expect(screen.getByTestId('authenticated').textContent).toBe('no')
    })
  })

  // =========================================================================
  // Logout
  // =========================================================================

  describe('logout()', () => {
    it('should clear user and isAuthenticated after logout', async () => {
      mockRefreshToken.mockResolvedValue(mockAuthResponse)
      mockFetchMe.mockResolvedValue(mockUser)
      mockLogoutApi.mockResolvedValue(undefined)

      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('user').textContent).toBe(mockUser.email),
      )

      await act(async () => {
        await userEvent.click(screen.getByText('Logout'))
      })

      expect(screen.getByTestId('user').textContent).toBe('none')
      expect(screen.getByTestId('authenticated').textContent).toBe('no')
    })

    it('should call logoutApi on logout', async () => {
      mockRefreshToken.mockResolvedValue(mockAuthResponse)
      mockFetchMe.mockResolvedValue(mockUser)
      mockLogoutApi.mockResolvedValue(undefined)

      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('user').textContent).toBe(mockUser.email),
      )

      await act(async () => {
        await userEvent.click(screen.getByText('Logout'))
      })

      expect(mockLogoutApi).toHaveBeenCalledOnce()
    })

    it('clears protected query data on logout', async () => {
      mockRefreshToken.mockResolvedValue(mockAuthResponse)
      mockFetchMe.mockResolvedValue(mockUser)
      mockLogoutApi.mockResolvedValue(undefined)

      const { queryClient } = renderWithProvider()
      queryClient.setQueryData(['clients', 'detail', 'client-a'], { name: 'Sensitive client' })
      await waitFor(() =>
        expect(screen.getByTestId('user').textContent).toBe(mockUser.email),
      )

      await act(async () => {
        await userEvent.click(screen.getByText('Logout'))
      })

      expect(queryClient.getQueryData(['clients', 'detail', 'client-a'])).toBeUndefined()
    })

    it('clears auth context and protected queries when the API refresh fails', async () => {
      mockRefreshToken.mockResolvedValue(mockAuthResponse)
      mockFetchMe.mockResolvedValue(mockUser)

      const { queryClient } = renderWithProvider()
      queryClient.setQueryData(['payments', 'detail', 'payment-a'], { amount: 500 })
      await waitFor(() =>
        expect(screen.getByTestId('user').textContent).toBe(mockUser.email),
      )

      act(() => authFailureHandler?.())

      expect(screen.getByTestId('authenticated').textContent).toBe('no')
      expect(queryClient.getQueryData(['payments', 'detail', 'payment-a'])).toBeUndefined()
    })

    it('clears the local session immediately while remote logout is pending', async () => {
      mockRefreshToken.mockResolvedValue(mockAuthResponse)
      mockFetchMe.mockResolvedValue(mockUser)
      const pendingLogout = deferred<void>()
      mockLogoutApi.mockReturnValue(pendingLogout.promise)

      const { queryClient } = renderWithProvider()
      queryClient.setQueryData(['clients'], [{ id: 'client-a' }])
      await waitFor(() =>
        expect(screen.getByTestId('user').textContent).toBe(mockUser.email),
      )

      act(() => screen.getByText('Logout').click())

      expect(screen.getByTestId('authenticated').textContent).toBe('no')
      expect(queryClient.getQueryData(['clients'])).toBeUndefined()
      pendingLogout.resolve()
    })
  })

  // =========================================================================
  // canDo() permission checking
  // =========================================================================

  describe('canDo()', () => {
    beforeEach(async () => {
      mockRefreshToken.mockResolvedValue(mockAuthResponse)
      mockFetchMe.mockResolvedValue(mockUser)
    })

    it('should return true for exact permission match', async () => {
      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('can-bookings-read').textContent).toBe('yes'),
      )
    })

    it('should return false for permission not in list', async () => {
      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('can-invoices-delete').textContent).toBe('no'),
      )
    })

    it('should return true for wildcard module permission (clients:*)', async () => {
      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('can-clients-anything').textContent).toBe('yes'),
      )
    })
  })

  // =========================================================================
  // Auto-refresh scheduling
  // =========================================================================

  describe('scheduleRefresh()', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should call refreshToken again after timer fires', async () => {
      mockRefreshToken
        .mockResolvedValueOnce(mockAuthResponse) // mount restore
        .mockResolvedValueOnce(mockAuthResponse) // scheduled refresh
      mockFetchMe.mockResolvedValue(mockUser)

      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('loading').textContent).toBe('ready'),
      )

      // expiresIn=900 → delay = (900-120)*1000 = 780000ms
      await act(async () => {
        vi.advanceTimersByTime(780_000)
        await Promise.resolve()
      })

      expect(mockRefreshToken).toHaveBeenCalledTimes(2)
    })

    it('should clear user when scheduled refresh fails', async () => {
      mockRefreshToken
        .mockResolvedValueOnce(mockAuthResponse) // mount restore
        .mockRejectedValueOnce(new Error('expired')) // scheduled refresh
      mockFetchMe.mockResolvedValue(mockUser)

      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('user').textContent).toBe(mockUser.email),
      )

      await act(async () => {
        vi.advanceTimersByTime(780_000)
        await Promise.resolve()
      })

      await waitFor(() =>
        expect(screen.getByTestId('user').textContent).toBe('none'),
      )
    })

    it('does not restore a token when an in-flight refresh resolves after logout', async () => {
      const lateRefresh = deferred<typeof mockAuthResponse>()
      let lateRefreshSignal: AbortSignal | undefined
      mockRefreshToken
        .mockResolvedValueOnce(mockAuthResponse)
        .mockImplementationOnce((signal?: AbortSignal) => {
          lateRefreshSignal = signal
          return lateRefresh.promise
        })
      mockFetchMe.mockResolvedValue(mockUser)
      mockLogoutApi.mockResolvedValue(undefined)

      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByTestId('user').textContent).toBe(mockUser.email),
      )

      act(() => {
        vi.advanceTimersByTime(780_000)
      })
      await waitFor(() => expect(mockRefreshToken).toHaveBeenCalledTimes(2))

      await act(async () => {
        await userEvent.click(screen.getByText('Logout'))
        expect(lateRefreshSignal?.aborted).toBe(true)
        lateRefresh.resolve({ ...mockAuthResponse, accessToken: 'late-token' })
        await Promise.resolve()
      })

      expect(mockSetAccessToken).not.toHaveBeenCalledWith('late-token')
      expect(screen.getByTestId('authenticated').textContent).toBe('no')
    })
  })
})
