import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock the OTP API so we don't hit the network.
vi.mock('./otp.api', () => ({
  requestOtp: vi.fn().mockResolvedValue(undefined),
}));

import { OtpRequestForm } from './otp-request-form';
import type { GuestClientInfo } from '@sawaa/shared';

const client: GuestClientInfo = { name: 'Ahmed', phone: '+966500000000', email: 'ahmed@test.com' };

describe('OtpRequestForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Send button enabled by default', () => {
    render(
      <OtpRequestForm
        client={client}
        onRequestSent={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /send verification code/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('calls onRequestSent after successful OTP request', async () => {
    const onRequestSent = vi.fn();
    render(
      <OtpRequestForm
        client={client}
        onRequestSent={onRequestSent}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));
    await waitFor(() => expect(onRequestSent).toHaveBeenCalled());
  });
});
