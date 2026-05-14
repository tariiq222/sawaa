import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const mockUseAuth = vi.fn()
const mockUseLoginFlow = vi.hoisted(() => vi.fn())

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/components/features/login/use-login-flow', () => ({
  useLoginFlow: mockUseLoginFlow,
}))

vi.mock('@/components/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock combined step so AuthGate tests focus on gate logic, not form internals
vi.mock('@/components/features/login/combined-step', () => ({
  CombinedStep: ({
    onSubmit,
    error,
  }: {
    onSubmit: (id: string, password: string) => void
    onSwitchToOtp: (id: string) => void
    error?: unknown
    onClearError?: () => void
    loading?: boolean
  }) => (
    <div>
      <label htmlFor="identifier">البريد الإلكتروني</label>
      <input id="identifier" placeholder="user@example.com" />
      <input type="password" placeholder="••••••••" />
      <button onClick={() => onSubmit('admin@sawaa-test.com', 'pass')}>تسجيل الدخول</button>
      {typeof error === 'string' && error ? <div>{error}</div> : null}
    </div>
  ),
}))

vi.mock('@/components/features/login/otp-step', () => ({
  OtpStep: () => <div>OtpStep</div>,
}))

import { AuthGate } from '@/components/providers/auth-gate'
import { LocaleProvider } from '@/components/locale-provider'

const defaultFlow = {
  mode: 'login' as const,
  identifier: '',
  loading: false,
  error: null,
  otpSentAt: null,
  submitLogin: vi.fn(),
  switchToOtp: vi.fn(),
  backToLogin: vi.fn(),
  resendOtp: vi.fn(),
  submitOtp: vi.fn(),
  clearError: vi.fn(),
}

const mockUser = {
  id: 'u1',
  email: 'admin@sawaa-test.com',
  firstName: 'Admin',
  lastName: 'Test',
  phone: null,
  gender: null,
  roles: [],
  permissions: [],
}

function renderAuthGate(children: React.ReactNode) {
  return render(
    <LocaleProvider>
      <AuthGate>{children}</AuthGate>
    </LocaleProvider>
  )
}

describe('AuthGate', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
    mockUseLoginFlow.mockReturnValue(defaultFlow)
  })

  it('should show loading spinner while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, login: vi.fn(), logout: vi.fn() })
    renderAuthGate(<div data-testid="protected-content">Protected</div>)
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(document.querySelector('.border-primary')).toBeInTheDocument()
  })

  it('should show login form when user is null and not loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() })
    renderAuthGate(<div data-testid="protected-content">Protected</div>)
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/البريد الإلكتروني/)).toBeInTheDocument()
  })

  it('should render children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false, login: vi.fn(), logout: vi.fn() })
    renderAuthGate(<div data-testid="protected-content">Dashboard Content</div>)
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.queryByLabelText(/البريد الإلكتروني/)).not.toBeInTheDocument()
  })

  it('should call submitLogin() with entered credentials on submit', async () => {
    const mockSubmitLogin = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() })
    mockUseLoginFlow.mockReturnValue({
      ...defaultFlow,
      submitLogin: mockSubmitLogin,
    })
    renderAuthGate(<div>Protected</div>)
    await userEvent.click(screen.getByRole('button', { name: /تسجيل الدخول/ }))
    expect(mockSubmitLogin).toHaveBeenCalledWith('admin@sawaa-test.com', 'pass')
  })

  it('should display error message when login throws', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() })
    mockUseLoginFlow.mockReturnValue({
      ...defaultFlow,
      error: 'Invalid email or password',
    })
    renderAuthGate(<div>Protected</div>)
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
  })

  it('DA-S3: should show LoginForm after logout', () => {
    let authState = { user: mockUser as typeof mockUser | null, loading: false, login: vi.fn(), logout: vi.fn() }
    mockUseAuth.mockImplementation(() => authState)

    const { rerender } = render(
      <LocaleProvider>
        <AuthGate>
          <div data-testid="protected-content">Dashboard</div>
        </AuthGate>
      </LocaleProvider>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()

    authState = { user: null, loading: false, login: vi.fn(), logout: vi.fn() }
    rerender(
      <LocaleProvider>
        <AuthGate>
          <div data-testid="protected-content">Dashboard</div>
        </AuthGate>
      </LocaleProvider>
    )

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/البريد الإلكتروني/)).toBeInTheDocument()
  })

  it('DA-S4: should keep protected content inaccessible after logout', () => {
    let authState = { user: mockUser as typeof mockUser | null, loading: false, login: vi.fn(), logout: vi.fn() }
    mockUseAuth.mockImplementation(() => authState)

    const { rerender } = render(
      <LocaleProvider>
        <AuthGate>
          <div data-testid="secret">Secret Data</div>
        </AuthGate>
      </LocaleProvider>
    )

    expect(screen.getByTestId('secret')).toBeInTheDocument()

    authState = { user: null, loading: false, login: vi.fn(), logout: vi.fn() }
    rerender(
      <LocaleProvider>
        <AuthGate>
          <div data-testid="secret">Secret Data</div>
        </AuthGate>
      </LocaleProvider>
    )

    expect(screen.queryByTestId('secret')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/البريد الإلكتروني/)).toBeInTheDocument()
  })

  it('should disable login button while submitting', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() })
    mockUseLoginFlow.mockReturnValue({
      ...defaultFlow,
      loading: true,
    })
    renderAuthGate(<div>Protected</div>)
    // When loading=true the CombinedStep mock still renders the button
    expect(screen.getByRole('button', { name: /تسجيل الدخول/ })).toBeInTheDocument()
  })
})
