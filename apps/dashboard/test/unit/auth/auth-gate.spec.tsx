import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const mockUseAuth = vi.fn()

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/components/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// LoginForm internals are covered by their own tests; AuthGate only decides
// whether to render it, the loading spinner, or the protected children.
vi.mock('@/components/features/login-form', () => ({
  LoginForm: () => <div data-testid="login-form">LoginForm</div>,
}))

import { AuthGate } from '@/components/providers/auth-gate'

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
  return render(<AuthGate>{children}</AuthGate>)
}

describe('AuthGate', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  it('should show loading spinner while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    renderAuthGate(<div data-testid="protected-content">Protected</div>)
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
    expect(document.querySelector('.border-primary')).toBeInTheDocument()
  })

  it('should show the login form when user is null and not loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderAuthGate(<div data-testid="protected-content">Protected</div>)
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByTestId('login-form')).toBeInTheDocument()
  })

  it('should render children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false })
    renderAuthGate(<div data-testid="protected-content">Dashboard Content</div>)
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
  })

  it('DA-S3: should show the login form after logout', () => {
    let authState: { user: typeof mockUser | null; loading: boolean } = {
      user: mockUser,
      loading: false,
    }
    mockUseAuth.mockImplementation(() => authState)

    const { rerender } = render(
      <AuthGate>
        <div data-testid="protected-content">Dashboard</div>
      </AuthGate>,
    )
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()

    authState = { user: null, loading: false }
    rerender(
      <AuthGate>
        <div data-testid="protected-content">Dashboard</div>
      </AuthGate>,
    )
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByTestId('login-form')).toBeInTheDocument()
  })

  it('DA-S4: should keep protected content inaccessible after logout', () => {
    let authState: { user: typeof mockUser | null; loading: boolean } = {
      user: mockUser,
      loading: false,
    }
    mockUseAuth.mockImplementation(() => authState)

    const { rerender } = render(
      <AuthGate>
        <div data-testid="secret">Secret Data</div>
      </AuthGate>,
    )
    expect(screen.getByTestId('secret')).toBeInTheDocument()

    authState = { user: null, loading: false }
    rerender(
      <AuthGate>
        <div data-testid="secret">Secret Data</div>
      </AuthGate>,
    )
    expect(screen.queryByTestId('secret')).not.toBeInTheDocument()
    expect(screen.getByTestId('login-form')).toBeInTheDocument()
  })
})
