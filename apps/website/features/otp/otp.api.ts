import { OtpChannel, OtpPurpose } from '@sawaa/shared';
import type { OtpRequestPayload, OtpVerifyPayload, OtpVerifyResponse } from '@sawaa/shared';

import { getApiBase } from '@/lib/api-base';

export async function requestOtp(payload: OtpRequestPayload): Promise<void> {
  const res = await fetch(`${getApiBase()}/public/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Failed to send OTP');
  }
}

export async function verifyOtp(
  identifier: string,
  code: string,
  purpose: OtpPurpose = OtpPurpose.GUEST_BOOKING,
): Promise<OtpVerifyResponse> {
  const payload: OtpVerifyPayload = {
    channel: OtpChannel.EMAIL,
    identifier,
    code,
    purpose,
  };
  const res = await fetch(`${getApiBase()}/public/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Invalid OTP code');
  }
  const json = await res.json();
  return (json.data ?? json) as OtpVerifyResponse;
}
