import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { GuestClientInfo } from '@sawaa/shared';
import { OtpVerifyForm } from './otp-verify-form';
import { LocaleProvider } from '@/features/locale/locale-provider';

const verifyOtpMock = vi.fn();

vi.mock('./otp.api', () => ({
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
}));

const client: GuestClientInfo = {
  name: 'Sara',
  email: 'sara@test.com',
  phone: '+966500000000',
};

function withLocale(children: ReactNode) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('OtpVerifyForm', () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    verifyOtpMock.mockResolvedValue({ sessionToken: 'tok-abc' });
  });

  it('disables the verify button until exactly 4 digits are entered', () => {
    render(withLocale(<OtpVerifyForm client={client} onVerified={vi.fn()} />));
    const btn = screen.getByRole('button', { name: /Verify/i }) as HTMLButtonElement;
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('0000'), {
      target: { value: '1234' },
    });
    expect(btn).not.toBeDisabled();
  });

  it('strips non-digit input from the code field', () => {
    render(withLocale(<OtpVerifyForm client={client} onVerified={vi.fn()} />));
    const input = screen.getByPlaceholderText('0000') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1a2b3c4d' } });
    expect(input.value).toBe('1234');
  });

  it('caps the code field at 4 characters', () => {
    render(withLocale(<OtpVerifyForm client={client} onVerified={vi.fn()} />));
    const input = screen.getByPlaceholderText('0000') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1234567890' } });
    expect(input.value).toBe('1234');
  });

  it('calls verifyOtp with the client email and the entered code', async () => {
    render(withLocale(<OtpVerifyForm client={client} onVerified={vi.fn()} />));
    fireEvent.change(screen.getByPlaceholderText('0000'), {
      target: { value: '1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Verify$/i }));
    await waitFor(() =>
      expect(verifyOtpMock).toHaveBeenCalledWith('sara@test.com', '1234'),
    );
  });

  it('invokes onVerified with the sessionToken on successful verification', async () => {
    const onVerified = vi.fn();
    render(withLocale(<OtpVerifyForm client={client} onVerified={onVerified} />));
    fireEvent.change(screen.getByPlaceholderText('0000'), {
      target: { value: '1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Verify$/i }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith('tok-abc'));
  });

  it('shows an error message when verifyOtp rejects', async () => {
    verifyOtpMock.mockRejectedValueOnce(new Error('Wrong code'));
    render(withLocale(<OtpVerifyForm client={client} onVerified={vi.fn()} />));
    fireEvent.change(screen.getByPlaceholderText('0000'), {
      target: { value: '0000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Verify$/i }));
    expect(await screen.findByText(/verification failed/i)).toBeTruthy();
  });

  it('shows the verifying label while the request is in flight', async () => {
    let resolveVerify: ((value: { sessionToken: string }) => void) | undefined;
    verifyOtpMock.mockReturnValueOnce(
      new Promise<{ sessionToken: string }>((res) => (resolveVerify = res)),
    );
    render(withLocale(<OtpVerifyForm client={client} onVerified={vi.fn()} />));
    fireEvent.change(screen.getByPlaceholderText('0000'), {
      target: { value: '1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Verify$/i }));
    const btn = await screen.findByRole('button', { name: /Verifying/i });
    expect(btn).toBeDisabled();
    resolveVerify!({ sessionToken: 'tok-late' });
  });

  it('keeps the verify button disabled when the code is shorter than 4 digits', () => {
    render(withLocale(<OtpVerifyForm client={client} onVerified={vi.fn()} />));
    const input = screen.getByPlaceholderText('0000') as HTMLInputElement;
    // maxLength=4 caps it, but the onChange regex strips non-digits so 2 chars stays at 2.
    fireEvent.change(input, { target: { value: '12' } });
    expect(input.value).toBe('12');
    expect(screen.getByRole('button', { name: /^Verify$/i })).toBeDisabled();
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });
});
