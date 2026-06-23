import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OtpChannel, OtpPurpose } from '@sawaa/shared';

const { getApiBaseMock } = vi.hoisted(() => ({
  getApiBaseMock: vi.fn(() => 'http://api.local/api/v1'),
}));

vi.mock('@/lib/api-base', () => ({
  getApiBase: getApiBaseMock,
}));

import { requestOtp, verifyOtp } from './otp.api';

describe('otp.api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getApiBaseMock.mockReturnValue('http://api.local/api/v1');
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('requestOtp', () => {
    it('POSTs to /public/otp/request with the typed payload as JSON', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      await requestOtp({
        channel: OtpChannel.SMS,
        identifier: '+966500000000',
        purpose: OtpPurpose.GUEST_BOOKING,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://api.local/api/v1/public/otp/request');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
      expect(init.body).toBe(
        JSON.stringify({
          channel: OtpChannel.SMS,
          identifier: '+966500000000',
          purpose: OtpPurpose.GUEST_BOOKING,
        }),
      );
    });

    it('resolves void on a 2xx response', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      await expect(
        requestOtp({ channel: OtpChannel.EMAIL, identifier: 'a@b.co', purpose: OtpPurpose.CLIENT_LOGIN }),
      ).resolves.toBeUndefined();
    });

    it('throws the backend message on a non-ok response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ message: 'Invalid identifier' }),
      });
      await expect(
        requestOtp({ channel: OtpChannel.EMAIL, identifier: 'bad', purpose: OtpPurpose.CLIENT_LOGIN }),
      ).rejects.toThrow('Invalid identifier');
    });

    it('falls back to statusText when the error body has no message', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable',
        json: () => Promise.reject(new Error('not json')),
      });
      await expect(
        requestOtp({ channel: OtpChannel.EMAIL, identifier: 'a@b.co', purpose: OtpPurpose.CLIENT_LOGIN }),
      ).rejects.toThrow('Service Unavailable');
    });
  });

  describe('verifyOtp', () => {
    it('POSTs to /public/otp/verify with channel/identifier/code/purpose as JSON and unwraps { data }', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { sessionToken: 'tok_abc' } }),
      });
      const out = await verifyOtp('a@b.co', '1234', OtpPurpose.CLIENT_LOGIN, OtpChannel.EMAIL);
      expect(out).toEqual({ sessionToken: 'tok_abc' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://api.local/api/v1/public/otp/verify');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body)).toEqual({
        channel: OtpChannel.EMAIL,
        identifier: 'a@b.co',
        code: '1234',
        purpose: OtpPurpose.CLIENT_LOGIN,
      });
    });

    it('passes a bare (no envelope) payload through unchanged', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sessionToken: 'tok_xyz' }),
      });
      await expect(
        verifyOtp('+966500000000', '0000', OtpPurpose.GUEST_BOOKING, OtpChannel.SMS),
      ).resolves.toEqual({ sessionToken: 'tok_xyz' });
    });

    it('defaults purpose to GUEST_BOOKING and channel to EMAIL when called with the minimal signature', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sessionToken: 'tok_min' }),
      });
      await verifyOtp('a@b.co', '1234');
      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        channel: OtpChannel.EMAIL,
        identifier: 'a@b.co',
        code: '1234',
        purpose: OtpPurpose.GUEST_BOOKING,
      });
    });

    it('throws the backend message on a non-ok response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Invalid OTP code' }),
      });
      await expect(verifyOtp('a@b.co', '0000')).rejects.toThrow('Invalid OTP code');
    });

    it('falls back to statusText when the error body cannot be parsed', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: () => Promise.reject(new Error('not json')),
      });
      await expect(verifyOtp('a@b.co', '0000')).rejects.toThrow('Unauthorized');
    });
  });
});
