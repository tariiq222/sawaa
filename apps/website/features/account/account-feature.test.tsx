import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ClientProfile } from '@sawaa/shared';

const pushMock = vi.fn();
const useCurrentClientMock = vi.fn();
const clientLogoutApiMock = vi.fn();
const clearAuthMock = vi.fn();

vi.mock('@/features/auth/public', () => ({
  useCurrentClient: () => useCurrentClientMock(),
  clientLogoutApi: () => clientLogoutApiMock(),
  clearAuth: () => clearAuthMock(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/features/auth/client-bookings-list', () => ({
  ClientBookingsList: () => <div data-testid="client-bookings-list">bookings</div>,
}));

import { AccountFeature } from './account-feature';
import { LocaleProvider } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';

function withLocale(locale: Locale, children: ReactNode) {
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

const fakeClient: ClientProfile = {
  id: 'c1',
  name: 'Sara Q.',
  email: 'sara@test.com',
  phone: '+966500000000',
  gender: null,
  avatarUrl: null,
  emailVerified: true,
  phoneVerified: false,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('AccountFeature', () => {
  beforeEach(() => {
    pushMock.mockReset();
    useCurrentClientMock.mockReset();
    clientLogoutApiMock.mockReset();
    clearAuthMock.mockReset();
  });

  it('renders the loading placeholder when isLoading is true', () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: true, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));
    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('redirects to /login and renders placeholder when error is present after loading', () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: false, error: 'boom', refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));
    expect(pushMock).toHaveBeenCalledWith('/login');
    // Still renders a non-crashing placeholder
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('redirects to /login when client is null after loading', () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));
    expect(pushMock).toHaveBeenCalledWith('/login');
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders profile name, email and phone when client is present', () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));
    expect(screen.getByText('Sara Q.')).toBeTruthy();
    expect(screen.getByText('sara@test.com')).toBeTruthy();
    expect(screen.getByText('+966500000000')).toBeTruthy();
    expect(screen.getByTestId('client-bookings-list')).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('logs out: calls clientLogoutApi, clearAuth, then router.push("/login")', async () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    clientLogoutApiMock.mockResolvedValue(undefined);
    render(withLocale('en', <AccountFeature locale="en" />));
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await waitFor(() => expect(clientLogoutApiMock).toHaveBeenCalled());
    expect(clearAuthMock).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith('/login');
  });

});
