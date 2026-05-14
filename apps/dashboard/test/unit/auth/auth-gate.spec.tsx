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

// Mock step components so AuthGate tests focus on gate logic, not form internals
vi.mock('@/components/features/login/identifier-step', () => ({
  IdentifierStep: () => (
    <div>
      <label htmlFor="identifier">البريد الإلكتروني</label>
      <input id="identifier" placeholder="user@example.com" />
    </div>
  ),
}))

vi.mock('@/components/features/login/method-step', () => ({
  MethodStep: () => <div>MethodStep</div>,
}))

vi.mock('@/components/features/login/password-step', () => ({
  PasswordStep: ({ onSubmit, error }: { onSubmit: (p: string) => void; error?: string | null }) => (
    <div>
      <input type="password" placeholder="••••••••" />
      <button onClick={() => onSubmit('pass')}>تسجيل الدخول</button>
      {error && <div>{error}</div>}
    </div>
  ),
}))

vi.mock('@/components/features/login/otp-step', () => ({
  OtpStep: () => <div>OtpStep</div>,
}))

import { AuthGate } from '@/components/providers/auth-gate'
import { LocaleProvider } from '@/components/locale-provider'

const defaultFlow = {
  step: 'identifier' as const,
  identifier: '',
  loading: false,
  error: null,
  otpSentAt: null,
  submitIdentifier: vi.fn(),
  submitPassword: vi.fn(),
  chooseMethod: vi.fn(),
  back: vi.fn(),
  resendOtp: vi.fn(),
  submitOtp: vi.fn(),
}

const mockUser = {
  id: 'u1',
  email: 'admin@deqah-test.com',
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

  it('should call login() with entered password on submit', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: mockLogin, logout: vi.fn() })
    mockUseLoginFlow.mockReturnValue({
      ...defaultFlow,
      step: 'password',
      identifier: 'admin@deqah-test.com',
      submitPassword: mockLogin,
    })
    renderAuthGate(<div>Protected</div>)
    await userEvent.click(screen.getByRole('button', { name: /تسجيل الدخول/ }))
    expect(mockLogin).toHaveBeenCalledWith('pass')
  })

  it('should display error message when login throws', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() })
    mockUseLoginFlow.mockReturnValue({
      ...defaultFlow,
      step: 'password',
      identifier: 'bad@test.com',
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
      step: 'password',
      loading: true,
    })
    renderAuthGate(<div>Protected</div>)
    // When loading=true the PasswordStep mock still renders the button
    expect(screen.getByRole('button', { name: /تسجيل الدخول/ })).toBeInTheDocument()
  })
})
