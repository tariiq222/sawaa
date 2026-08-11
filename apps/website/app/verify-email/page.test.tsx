import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LocaleProvider } from '@/features/locale/locale-provider';

const { paramsGetMock, fetchMock } = vi.hoisted(() => ({
  paramsGetMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: paramsGetMock }),
}));

import VerifyEmailPage from './page';

function withLocale(locale: 'ar' | 'en', children: ReactNode) {
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

function mockOkResponse() {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
}

function mockErrorResponse(status: number) {
  fetchMock.mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ message: 'BadRequestException' }),
  });
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    paramsGetMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows the invalid-token error in Arabic when no token is present', () => {
    paramsGetMock.mockReturnValue(null);
    render(withLocale('ar', <VerifyEmailPage />));
    expect(
      screen.getByRole('heading', { name: 'تعذر التحقق' }),
    ).toBeTruthy();
    expect(
      screen.getByText('رابط التحقق غير صالح أو منتهي الصلاحية'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'العودة للرئيسية' })).toBeTruthy();
  });

  it('shows the invalid-token error in English when no token is present', () => {
    paramsGetMock.mockReturnValue(null);
    render(withLocale('en', <VerifyEmailPage />));
    expect(
      screen.getByRole('heading', { name: 'Verification failed' }),
    ).toBeTruthy();
    expect(
      screen.getByText('The verification link is invalid or expired'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeTruthy();
  });

  it('verifies a valid token and shows the Arabic success state', async () => {
    paramsGetMock.mockReturnValue('tok123');
    mockOkResponse();
    render(withLocale('ar', <VerifyEmailPage />));
    expect(
      await screen.findByRole('heading', { name: 'تم تأكيد بريدك الإلكتروني' }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('verify-email?token=tok123'),
    );
    expect(
      screen.getByRole('link', { name: 'تسجيل الدخول' }),
    ).toBeTruthy();
  });

  it('verifies a valid token and shows the English success state', async () => {
    paramsGetMock.mockReturnValue('tok123');
    mockOkResponse();
    render(withLocale('en', <VerifyEmailPage />));
    expect(
      await screen.findByRole('heading', { name: 'Email verified' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(
      screen.getByText(/You can now sign in and use all services/i),
    ).toBeTruthy();
  });

  it('never surfaces the English backend message — shows the localized failure text', async () => {
    paramsGetMock.mockReturnValue('tok123');
    mockErrorResponse(400);
    render(withLocale('ar', <VerifyEmailPage />));
    expect(await screen.findByText('فشل التحقق من البريد')).toBeTruthy();
    expect(screen.queryByText(/BadRequestException/)).toBeNull();
  });

  it('shows the localized connection error when the network request fails', async () => {
    paramsGetMock.mockReturnValue('tok123');
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(withLocale('en', <VerifyEmailPage />));
    expect(await screen.findByText('Connection error')).toBeTruthy();
  });

  it('announces the verifying state as a live status region', () => {
    paramsGetMock.mockReturnValue('tok123');
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(withLocale('en', <VerifyEmailPage />));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/verifying your email/i);
  });

  it('does not re-fetch a consumed token when the locale changes and keeps the success', async () => {
    paramsGetMock.mockReturnValue('tok123');
    // First call succeeds and consumes the one-time token; any re-fetch would
    // fail like an already-used token.
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { rerender } = render(withLocale('ar', <VerifyEmailPage />));
    await screen.findByRole('heading', { name: 'تم تأكيد بريدك الإلكتروني' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Simulate a locale switch — copy must update without re-verification.
    rerender(withLocale('en', <VerifyEmailPage />));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('heading', { name: 'Email verified' }),
    ).toBeTruthy();
    expect(
      screen.getByText(/You can now sign in and use all services/i),
    ).toBeTruthy();
  });

  it('re-translates the error copy on a locale change without any request', () => {
    paramsGetMock.mockReturnValue(null);
    const { rerender } = render(withLocale('ar', <VerifyEmailPage />));
    expect(
      screen.getByText('رابط التحقق غير صالح أو منتهي الصلاحية'),
    ).toBeTruthy();
    rerender(withLocale('en', <VerifyEmailPage />));
    expect(
      screen.getByText('The verification link is invalid or expired'),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
