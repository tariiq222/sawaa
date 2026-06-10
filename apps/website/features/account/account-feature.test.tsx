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

vi.mock('./overview-tab', () => ({
  OverviewTab: ({ onGoToInvoices }: { onGoToInvoices: () => void }) => (
    <div data-testid="overview-tab">
      <button onClick={onGoToInvoices}>go-to-invoices</button>
    </div>
  ),
}));

vi.mock('./invoices-tab', () => ({
  InvoicesTab: () => <div data-testid="invoices-tab">invoices</div>,
}));

vi.mock('./profile-tab', () => ({
  ProfileTab: () => <div data-testid="profile-tab">profile</div>,
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
  emailVerified: '2026-01-01T00:00:00.000Z',
  phoneVerified: null,
  accountType: 'REGISTERED',
  claimedAt: null,
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
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('renders all four tabs and shows the overview tab by default', () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs.map((el) => el.textContent)).toEqual([
      'Overview',
      'My Bookings',
      'Invoices & Payments',
      'Profile',
    ]);
    expect(screen.getByTestId('overview-tab')).toBeTruthy();
    expect(screen.queryByTestId('client-bookings-list')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
  });

  it('switches tabs: bookings, invoices, profile', () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));

    fireEvent.click(screen.getByRole('tab', { name: 'My Bookings' }));
    expect(screen.getByTestId('client-bookings-list')).toBeTruthy();
    expect(screen.queryByTestId('overview-tab')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Invoices & Payments' }));
    expect(screen.getByTestId('invoices-tab')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Profile' }));
    expect(screen.getByTestId('profile-tab')).toBeTruthy();
  });

  it('renders Arabic tab labels under ar locale', () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('ar', <AccountFeature locale="ar" />));
    expect(screen.getByRole('tab', { name: 'نظرة عامة' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'حجوزاتي' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'الفواتير والمدفوعات' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'الملف الشخصي' })).toBeTruthy();
  });

  it('switches to the invoices tab when the overview unpaid alert callback fires', () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));
    fireEvent.click(screen.getByText('go-to-invoices'));
    expect(screen.getByTestId('invoices-tab')).toBeTruthy();
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
