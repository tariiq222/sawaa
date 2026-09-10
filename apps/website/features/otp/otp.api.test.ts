import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OtpChannel, OtpPurpose } from '@sawaa/shared';

const { publicFetchMock, PublicFetchErrorMock } = vi.hoisted(() => {
  class FakePublicFetchError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
    ) {
      super(`PublicFetchError: ${status}`);
    }
  }

  return {
    publicFetchMock: vi.fn(),
    PublicFetchErrorMock: FakePublicFetchError,
  };
});

vi.mock('@/lib/public-fetch', () => ({
  publicFetch: publicFetchMock,
  PublicFetchError: PublicFetchErrorMock,
}));

import { requestOtp, verifyOtp } from './otp.api';

describe('otp.api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('requestOtp', () => {
    it('POSTs the typed payload through the CSRF-aware public request helper', async () => {
      publicFetchMock.mockResolvedValue(undefined);
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      await requestOtp({
        channel: OtpChannel.SMS,
        identifier: '+966500000000',
        purpose: OtpPurpose.GUEST_BOOKING,
      });
      const [url, init] = publicFetchMock.mock.calls[0];
      expect(url).toBe('/public/otp/request');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(
        JSON.stringify({
          channel: OtpChannel.SMS,
          identifier: '+966500000000',
          purpose: OtpPurpose.GUEST_BOOKING,
        }),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('resolves void on a 2xx response', async () => {
      publicFetchMock.mockResolvedValue(undefined);
      await expect(
        requestOtp({ channel: OtpChannel.EMAIL, identifier: 'a@b.co', purpose: OtpPurpose.CLIENT_LOGIN }),
      ).resolves.toBeUndefined();
    });

    it('throws the backend message on a public request error', async () => {
      publicFetchMock.mockRejectedValue(new PublicFetchErrorMock(400, { message: 'Invalid identifier' }));
      await expect(
        requestOtp({ channel: OtpChannel.EMAIL, identifier: 'bad', purpose: OtpPurpose.CLIENT_LOGIN }),
      ).rejects.toThrow('Invalid identifier');
    });

    it('uses its stable fallback when the public request error has no message', async () => {
      publicFetchMock.mockRejectedValue(new PublicFetchErrorMock(503, {}));
      await expect(
        requestOtp({ channel: OtpChannel.EMAIL, identifier: 'a@b.co', purpose: OtpPurpose.CLIENT_LOGIN }),
      ).rejects.toThrow('Failed to send OTP');
    });
  });

  describe('verifyOtp', () => {
    it('POSTs through the CSRF-aware helper and unwraps { data }', async () => {
      publicFetchMock.mockResolvedValue({ data: { sessionToken: 'tok_abc' } });
      const out = await verifyOtp('a@b.co', '1234', OtpPurpose.CLIENT_LOGIN, OtpChannel.EMAIL);
      expect(out).toEqual({ sessionToken: 'tok_abc' });
      const [url, init] = publicFetchMock.mock.calls[0];
      expect(url).toBe('/public/otp/verify');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        channel: OtpChannel.EMAIL,
        identifier: 'a@b.co',
        code: '1234',
        purpose: OtpPurpose.CLIENT_LOGIN,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('passes a bare (no envelope) payload through unchanged', async () => {
      publicFetchMock.mockResolvedValue({ sessionToken: 'tok_xyz' });
      await expect(
        verifyOtp('+966500000000', '0000', OtpPurpose.GUEST_BOOKING, OtpChannel.SMS),
      ).resolves.toEqual({ sessionToken: 'tok_xyz' });
    });

    it('defaults purpose to GUEST_BOOKING and channel to EMAIL when called with the minimal signature', async () => {
      publicFetchMock.mockResolvedValue({ sessionToken: 'tok_min' });
      await verifyOtp('a@b.co', '1234');
      const [, init] = publicFetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        channel: OtpChannel.EMAIL,
        identifier: 'a@b.co',
        code: '1234',
        purpose: OtpPurpose.GUEST_BOOKING,
      });
    });

    it('throws the backend message on a public request error', async () => {
      publicFetchMock.mockRejectedValue(new PublicFetchErrorMock(401, { message: 'Invalid OTP code' }));
      await expect(verifyOtp('a@b.co', '0000')).rejects.toThrow('Invalid OTP code');
    });

    it('uses its stable fallback when the public request error has no message', async () => {
      publicFetchMock.mockRejectedValue(new PublicFetchErrorMock(401, {}));
      await expect(verifyOtp('a@b.co', '0000')).rejects.toThrow('Invalid OTP code');
    });
  });
});
