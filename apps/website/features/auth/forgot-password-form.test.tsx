import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const requestOtpMock = vi.fn();
const pushMock = vi.fn();

vi.mock('@/features/otp/otp.api', () => ({
  requestOtp: (...args: unknown[]) => requestOtpMock(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ForgotPasswordForm } from './forgot-password-form';
import { LocaleProvider } from '@/features/locale/locale-provider';
import { OtpChannel, OtpPurpose } from '@sawaa/shared';

function withLocale(children: ReactNode) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    requestOtpMock.mockReset();
    requestOtpMock.mockResolvedValue(undefined);
    pushMock.mockReset();
  });

  it('submits a valid email identifier via the EMAIL channel and CLIENT_PASSWORD_RESET purpose', async () => {
    render(withLocale(<ForgotPasswordForm />));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'sara@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() =>
      expect(requestOtpMock).toHaveBeenCalledWith({
        channel: OtpChannel.EMAIL,
        identifier: 'sara@example.com',
        purpose: OtpPurpose.CLIENT_PASSWORD_RESET,
      }),
    );
  });

  it('submits a phone identifier normalized to E.164 via the SMS channel', async () => {
    render(withLocale(<ForgotPasswordForm />));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: '0501234567' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() =>
      expect(requestOtpMock).toHaveBeenCalledWith({
        channel: OtpChannel.SMS,
        identifier: '+966501234567',
        purpose: OtpPurpose.CLIENT_PASSWORD_RESET,
      }),
    );
  });

  it('routes to /reset-password with the normalized identifier on success', async () => {
    render(withLocale(<ForgotPasswordForm />));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: '0501234567' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/reset-password?identifier=${encodeURIComponent('+966501234567')}`,
      ),
    );
  });

  it('invokes onSuccess with the normalized identifier instead of routing', async () => {
    const onSuccess = vi.fn();
    render(withLocale(<ForgotPasswordForm onSuccess={onSuccess} />));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'sara@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('sara@example.com'));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('trims whitespace around the email before sending', async () => {
    render(withLocale(<ForgotPasswordForm />));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: '  sara@example.com  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() =>
      expect(requestOtpMock).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'sara@example.com' }),
      ),
    );
  });

  it('shows an inline email error when the email is malformed and does NOT call the API', async () => {
    render(withLocale(<ForgotPasswordForm />));
    // "notanemail" lacks '@' so it goes down the phone branch.
    // Use a value with '@' that still fails the email regex (no dot in domain).
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'broken@email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Invalid email address/);
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it('shows a phone error when the phone is not a valid Saudi number', async () => {
    render(withLocale(<ForgotPasswordForm />));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'abc' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Invalid phone number/);
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it('surfaces an error when requestOtp rejects and does not navigate', async () => {
    requestOtpMock.mockRejectedValueOnce(new Error('Rate limited'));
    render(withLocale(<ForgotPasswordForm />));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'sara@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Failed to send verification code/);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows a loading state on the submit button while the request is in flight', async () => {
    let resolvePromise: (() => void) | undefined;
    requestOtpMock.mockReturnValueOnce(new Promise<void>((res) => (resolvePromise = res)));
    render(withLocale(<ForgotPasswordForm />));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'sara@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    const btn = await screen.findByRole('button', { name: /sending/i });
    expect(btn).toBeDisabled();
    resolvePromise!();
  });

  it('renders Arabic validation messages under ar locale', async () => {
    render(
      <LocaleProvider locale="ar">
        <ForgotPasswordForm />
      </LocaleProvider>,
    );
    fireEvent.change(screen.getByLabelText(/البريد/), {
      target: { value: 'abc' },
    });
    fireEvent.click(screen.getByRole('button', { name: /إرسال/ }));
    // Phone error goes through t('auth.invalidPhone') and is localized.
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/رقم الجوال/);
    expect(requestOtpMock).not.toHaveBeenCalled();
  });
});
