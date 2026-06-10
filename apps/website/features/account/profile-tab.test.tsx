import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ClientProfile } from '@sawaa/shared';

const useCurrentClientMock = vi.fn();
const setClientMock = vi.fn();

vi.mock('@/features/auth/use-current-client', () => ({
  useCurrentClient: () => useCurrentClientMock(),
  CURRENT_CLIENT_QUERY_KEY: ['client', 'me'],
}));

vi.mock('@/features/auth/auth-store', () => ({
  setClient: (...args: unknown[]) => setClientMock(...args),
}));

vi.mock('./account.api', () => ({
  updateMyProfileApi: vi.fn(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileTab } from './profile-tab';
import { updateMyProfileApi } from './account.api';
import { LocaleProvider } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';

const updateMock = vi.mocked(updateMyProfileApi);

let queryClient: QueryClient;

function withLocale(locale: Locale, children: ReactNode) {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider locale={locale}>{children}</LocaleProvider>
    </QueryClientProvider>
  );
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

describe('ProfileTab', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useCurrentClientMock.mockReset();
    setClientMock.mockReset();
    updateMock.mockReset();
    useCurrentClientMock.mockReturnValue({
      client: fakeClient,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('prefills name and phone from the current client and shows read-only email', () => {
    render(withLocale('ar', <ProfileTab />));
    expect((screen.getByLabelText('الاسم') as HTMLInputElement).value).toBe('Sara Q.');
    expect((screen.getByLabelText('رقم الجوال') as HTMLInputElement).value).toBe('+966500000000');
    expect(screen.getByText('sara@test.com')).toBeTruthy();
    expect(screen.getByText('البريد مُوثّق')).toBeTruthy();
    // password reset link
    const pwLink = screen.getByRole('link', { name: 'تغيير كلمة المرور' });
    expect(pwLink.getAttribute('href')).toBe('/forgot-password');
  });

  it('submits only the changed fields and updates the auth store on success', async () => {
    const updated = { ...fakeClient, name: 'Sara Updated' };
    updateMock.mockResolvedValue(updated);
    render(withLocale('ar', <ProfileTab />));

    fireEvent.change(screen.getByLabelText('الاسم'), { target: { value: 'Sara Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ name: 'Sara Updated' }));
    expect(setClientMock).toHaveBeenCalledWith(updated);
    expect(await screen.findByText('تم حفظ التغييرات')).toBeTruthy();
  });

  it('updates the shared current-client query cache so the account header refreshes', async () => {
    const updated = { ...fakeClient, name: 'Sara Updated' };
    updateMock.mockResolvedValue(updated);
    render(withLocale('ar', <ProfileTab />));

    fireEvent.change(screen.getByLabelText('الاسم'), { target: { value: 'Sara Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }));

    await waitFor(() =>
      expect(queryClient.getQueryData(['client', 'me'])).toEqual(updated),
    );
  });

  it('rejects a name shorter than 2 characters without calling the API', async () => {
    render(withLocale('ar', <ProfileTab />));
    fireEvent.change(screen.getByLabelText('الاسم'), { target: { value: 'س' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }));

    expect(await screen.findByText('الاسم يجب ألا يقل عن حرفين.')).toBeTruthy();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone and warns when phone changes', async () => {
    render(withLocale('ar', <ProfileTab />));
    fireEvent.change(screen.getByLabelText('رقم الجوال'), { target: { value: 'abc' } });
    // phone-changed warning appears immediately
    expect(screen.getByText('تغيير رقم الجوال يتطلب توثيقه من جديد.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }));
    expect(await screen.findByText('رقم الجوال غير صالح.')).toBeTruthy();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('shows an error message when the API call fails', async () => {
    updateMock.mockRejectedValue(new Error('boom'));
    render(withLocale('ar', <ProfileTab />));
    fireEvent.change(screen.getByLabelText('الاسم'), { target: { value: 'Sara Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }));

    expect(await screen.findByText('تعذر حفظ التغييرات، حاول مرة أخرى.')).toBeTruthy();
    expect(setClientMock).not.toHaveBeenCalled();
  });
});
