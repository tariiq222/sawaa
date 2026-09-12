import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ClientProfile } from '@sawaa/shared';

const pushMock = vi.fn();
const useCurrentClientMock = vi.fn();
const clientLogoutApiMock = vi.fn();
const clearAuthMock = vi.fn();
const confirmLogoutMock = vi.fn();

vi.mock('@/features/auth/public', () => ({
  useCurrentClient: () => ({
    clearSession: clearAuthMock,
    confirmLogout: confirmLogoutMock,
    ...useCurrentClientMock(),
  }),
  clientLogoutApi: () => clientLogoutApiMock(),
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

vi.mock('@/features/chat/account-conversations-tab', () => ({
  AccountConversationsTab: () => <div data-testid="account-conversations-tab">conversations</div>,
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
    confirmLogoutMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the loading placeholder when isLoading is true', () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: true, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));
    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows retry without redirecting when a transient error occurs before a profile is cached', () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: false, error: 'boom', refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('redirects to /login when client is null after loading', () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));
    expect(pushMock).toHaveBeenCalledWith('/login');
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('keeps a transient profile error retryable without redirecting to login', () => {
    const refetchMock = vi.fn();
    useCurrentClientMock.mockReturnValue({
      client: fakeClient,
      isLoading: false,
      error: 'temporary outage',
      refetch: refetchMock,
    });
    render(withLocale('en', <AccountFeature locale="en" />));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retry);
    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it('renders profile name, email and phone when client is present', () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));
    expect(screen.getByText('Sara Q.')).toBeTruthy();
    expect(screen.getByText('sara@test.com')).toBeTruthy();
    expect(screen.getByText('+966500000000')).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('renders all five tabs and shows the overview tab by default', () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(tabs.map((el) => el.textContent)).toEqual([
      'Overview',
      'My Bookings',
      'Invoices & Payments',
      'My Conversations',
      'Profile',
    ]);
    expect(screen.getByTestId('overview-tab')).toBeTruthy();
    expect(screen.queryByTestId('client-bookings-list')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
  });

  it('switches tabs: bookings, invoices, conversations, profile', () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('en', <AccountFeature locale="en" />));

    fireEvent.click(screen.getByRole('tab', { name: 'My Bookings' }));
    expect(screen.getByTestId('client-bookings-list')).toBeTruthy();
    expect(screen.queryByTestId('overview-tab')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Invoices & Payments' }));
    expect(screen.getByTestId('invoices-tab')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'My Conversations' }));
    expect(screen.getByTestId('account-conversations-tab')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Profile' }));
    expect(screen.getByTestId('profile-tab')).toBeTruthy();
  });

  it('renders Arabic tab labels under ar locale', () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    render(withLocale('ar', <AccountFeature locale="ar" />));
    expect(screen.getByRole('tab', { name: 'نظرة عامة' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'مواعيدي' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'الفواتير والمدفوعات' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'محادثاتي' })).toBeTruthy();
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
    expect(confirmLogoutMock).toHaveBeenCalledOnce();
    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  it('clears local auth promptly and stays on the page when revocation remains unknown', async () => {
    vi.useFakeTimers();
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    clientLogoutApiMock.mockReturnValue(new Promise<void>(() => undefined));
    render(withLocale('en', <AccountFeature locale="en" />));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
      await Promise.resolve();
    });

    expect(clientLogoutApiMock).toHaveBeenCalledOnce();
    expect(clearAuthMock).toHaveBeenCalledOnce();
    expect(pushMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText(/signed out successfully/i)).toBeNull();
  });

  it('treats logout 401 as known signed out', async () => {
    useCurrentClientMock.mockReturnValue({
      client: fakeClient,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    clientLogoutApiMock.mockRejectedValue(Object.assign(new Error('invalid session'), { status: 401 }));

    render(withLocale('en', <AccountFeature locale="en" />));
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(confirmLogoutMock).toHaveBeenCalledOnce());
    expect(pushMock).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Your local session was cleared, but server sign-out could not be confirmed.')).toBeNull();
  });

  it('keeps a logout 403 recoverable because it may be a CSRF rejection', async () => {
    useCurrentClientMock.mockReturnValue({
      client: fakeClient,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    clientLogoutApiMock.mockRejectedValue(Object.assign(new Error('csrf rejected'), { status: 403 }));

    render(withLocale('en', <AccountFeature locale="en" />));
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(screen.getByText('Sign-out confirmation is still pending. Your local session was cleared; try again.')).toBeTruthy());
    expect(confirmLogoutMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('keeps logout recovery visible after remount while auth reads are blocked', () => {
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      sessionReadBlocked: true,
    });

    render(withLocale('en', <AccountFeature locale="en" />));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('redirects terminally expired auth to login without showing logout recovery', () => {
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      sessionReadBlocked: false,
    });

    render(withLocale('en', <AccountFeature locale="en" />));

    expect(pushMock).toHaveBeenCalledWith('/login');
    expect(screen.queryByRole('status')).toBeNull();
  });

  describe('add-email notice', () => {
    const noEmailClient: ClientProfile = { ...fakeClient, email: null, emailVerified: null };

    it('does not show the notice when the client has an email', () => {
      useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
      render(withLocale('en', <AccountFeature locale="en" />));
      expect(
        screen.queryByText('Add an email address to receive invoices and notifications.'),
      ).toBeNull();
    });

    it('shows the notice on the overview tab when the client has no email', () => {
      useCurrentClientMock.mockReturnValue({ client: noEmailClient, isLoading: false, error: null, refetch: vi.fn() });
      render(withLocale('en', <AccountFeature locale="en" />));
      expect(
        screen.getByText('Add an email address to receive invoices and notifications.'),
      ).toBeTruthy();
    });

    it('switches to the profile tab when the notice CTA is clicked', () => {
      useCurrentClientMock.mockReturnValue({ client: noEmailClient, isLoading: false, error: null, refetch: vi.fn() });
      render(withLocale('en', <AccountFeature locale="en" />));
      fireEvent.click(screen.getByRole('button', { name: /add email/i }));
      expect(screen.getByTestId('profile-tab')).toBeTruthy();
      expect(screen.getByRole('tab', { name: 'Profile' }).getAttribute('aria-selected')).toBe('true');
    });

    it('hides the notice for the rest of the render when dismissed', () => {
      useCurrentClientMock.mockReturnValue({ client: noEmailClient, isLoading: false, error: null, refetch: vi.fn() });
      render(withLocale('en', <AccountFeature locale="en" />));
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(
        screen.queryByText('Add an email address to receive invoices and notifications.'),
      ).toBeNull();
    });
  });
});
