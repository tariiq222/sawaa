import { OtpChannel, OtpPurpose } from '@sawaa/shared';
import type { OtpRequestPayload, OtpVerifyPayload, OtpVerifyResponse } from '@sawaa/shared';

import { PublicFetchError, publicFetch } from '@/lib/public-fetch';

export async function requestOtp(payload: OtpRequestPayload): Promise<void> {
  try {
    await publicFetch<void>('/public/otp/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw otpRequestError(error, 'Failed to send OTP');
  }
}

export async function verifyOtp(
  identifier: string,
  code: string,
  purpose: OtpPurpose = OtpPurpose.GUEST_BOOKING,
  channel: OtpChannel = OtpChannel.EMAIL,
): Promise<OtpVerifyResponse> {
  const payload: OtpVerifyPayload = {
    channel,
    identifier,
    code,
    purpose,
  };
  try {
    const json = await publicFetch<unknown>('/public/otp/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapOtpResponse(json);
  } catch (error) {
    throw otpRequestError(error, 'Invalid OTP code');
  }
}

function unwrapOtpResponse(json: unknown): OtpVerifyResponse {
  if (typeof json === 'object' && json !== null && 'data' in json) {
    return json.data as OtpVerifyResponse;
  }

  return json as OtpVerifyResponse;
}

function otpRequestError(error: unknown, fallback: string): Error {
  if (!(error instanceof PublicFetchError)) {
    return error instanceof Error ? error : new Error(fallback);
  }

  const message = readErrorMessage(error.body);
  return new Error(message ?? fallback);
}

function readErrorMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return undefined;
  }

  return typeof body.message === 'string' ? body.message : undefined;
}
