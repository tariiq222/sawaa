import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks — must be declared before importing the SUT.
const {
  clientLoginMock,
  clientRegisterMock,
  clientLogoutMock,
  clientResetPasswordMock,
  setClientBaseUrlMock,
  setMeBaseUrlMock,
  getMeMock,
  getMyBookingsMock,
  cancelMyBookingMock,
  rescheduleMyBookingMock,
  apiRequestMock,
  getApiBaseMock,
} = vi.hoisted(() => ({
  clientLoginMock: vi.fn(),
  clientRegisterMock: vi.fn(),
  clientLogoutMock: vi.fn(),
  clientResetPasswordMock: vi.fn(),
  setClientBaseUrlMock: vi.fn(),
  setMeBaseUrlMock: vi.fn(),
  getMeMock: vi.fn(),
  getMyBookingsMock: vi.fn(),
  cancelMyBookingMock: vi.fn(),
  rescheduleMyBookingMock: vi.fn(),
  apiRequestMock: vi.fn(),
  getApiBaseMock: vi.fn(() => 'http://api.local/api/v1'),
}));

vi.mock('@sawaa/api-client', () => ({
  clientLogin: clientLoginMock,
  clientRegister: clientRegisterMock,
  clientLogout: clientLogoutMock,
  clientResetPassword: clientResetPasswordMock,
  setClientBaseUrl: setClientBaseUrlMock,
  setMeBaseUrl: setMeBaseUrlMock,
  getMe: getMeMock,
  getMyBookings: getMyBookingsMock,
  cancelMyBooking: cancelMyBookingMock,
  rescheduleMyBooking: rescheduleMyBookingMock,
  apiRequest: apiRequestMock,
}));

vi.mock('@/lib/api-base', () => ({
  getApiBase: getApiBaseMock,
}));

const fetchMock = vi.fn();
beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

import {
  clientLoginApi,
  clientRegisterApi,
  clientLogoutApi,
  clientResetPasswordApi,
  getMeApi,
  getMyBookingsApi,
  getMyBookingApi,
  cancelMyBookingApi,
  rescheduleMyBookingApi,
} from './auth.api';

const fakeProfile = {
  id: 'c1',
  name: 'Sara',
  email: 'sara@test.com',
  phone: '+966500000000',
  emailVerified: '2026-01-01T00:00:00.000Z',
  phoneVerified: null,
  accountType: 'REGISTERED' as const,
  claimedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('auth.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiRequestMock.mockReset();
    getApiBaseMock.mockReturnValue('http://api.local/api/v1');
  });

  describe('initialisation', () => {
    it('sets the api base urls on the api-client modules exactly once across calls', async () => {
      apiRequestMock.mockResolvedValue(fakeProfile);
      await getMeApi();
      await clientLogoutApi();
      expect(setClientBaseUrlMock).toHaveBeenCalledTimes(1);
      expect(setMeBaseUrlMock).toHaveBeenCalledTimes(1);
      expect(setClientBaseUrlMock).toHaveBeenCalledWith('http://api.local/api/v1');
      expect(setMeBaseUrlMock).toHaveBeenCalledWith('http://api.local/api/v1');
    });

    it('exposes getMeApi through the shared request client with a bounded signal', async () => {
      apiRequestMock.mockResolvedValue(fakeProfile);
      await getMeApi();
      expect(apiRequestMock).toHaveBeenCalledWith('/public/me', {
        credentials: 'include',
        signal: expect.any(AbortSignal),
      });
    });
  });

  describe('clientLoginApi', () => {
    it('forwards the payload to clientLogin', async () => {
      clientLoginMock.mockResolvedValue({ client: fakeProfile });
      await clientLoginApi({ email: 'a@b.co', password: 'Secret1' });
      expect(clientLoginMock).toHaveBeenCalledWith({ email: 'a@b.co', password: 'Secret1' });
    });

    it('propagates errors from clientLogin unchanged', async () => {
      clientLoginMock.mockRejectedValue(new Error('Invalid credentials'));
      await expect(clientLoginApi({ email: 'a@b.co', password: 'bad' })).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('clientRegisterApi', () => {
    it('forwards the registration payload to clientRegister', async () => {
      clientRegisterMock.mockResolvedValue({ client: fakeProfile });
      await clientRegisterApi({
        name: 'Sara',
        otpSessionToken: 'otp-session-xyz',
        password: 'Secret1',
      });
      expect(clientRegisterMock).toHaveBeenCalledWith({
        name: 'Sara',
        otpSessionToken: 'otp-session-xyz',
        password: 'Secret1',
      });
    });
  });

  describe('getMeApi', () => {
    it('returns the current client profile from the api-client', async () => {
      apiRequestMock.mockResolvedValue(fakeProfile);
      await expect(getMeApi()).resolves.toEqual(fakeProfile);
    });

    it('aborts and rejects a profile request that exceeds the auth deadline', async () => {
      vi.useFakeTimers();
      let requestSignal: AbortSignal | undefined;
      apiRequestMock.mockImplementation((_path: string, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          requestSignal?.addEventListener('abort', () => reject(requestSignal?.reason), { once: true });
        });
      });

      const request = expect(getMeApi()).rejects.toMatchObject({ name: 'TimeoutError' });
      await vi.advanceTimersByTimeAsync(10_000);

      await request;
      expect(requestSignal?.aborted).toBe(true);
    });
  });

  describe('getMyBookingsApi', () => {
    it('forwards pagination defaults of 1 and 10', async () => {
      getMyBookingsMock.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0 });
      await getMyBookingsApi();
      expect(getMyBookingsMock).toHaveBeenCalledWith(1, 10);
    });

    it('forwards custom pagination parameters', async () => {
      getMyBookingsMock.mockResolvedValue({ items: [], page: 3, pageSize: 25, total: 0 });
      await getMyBookingsApi(3, 25);
      expect(getMyBookingsMock).toHaveBeenCalledWith(3, 25);
    });
  });

  describe('getMyBookingApi', () => {
    it('uses the shared API client so expired access cookies take its 401 refresh path', async () => {
      const booking = { id: 'b1', status: 'CONFIRMED' };
      apiRequestMock.mockResolvedValue(booking);
      await expect(getMyBookingApi('b1')).resolves.toEqual(booking);
      expect(apiRequestMock).toHaveBeenCalledWith('/public/me/bookings/b1', {
        credentials: 'include',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('URL-encodes the booking id', async () => {
      apiRequestMock.mockResolvedValue({ id: 'b3' });
      await getMyBookingApi('a/b c');
      expect(apiRequestMock).toHaveBeenCalledWith(
        `/public/me/bookings/${encodeURIComponent('a/b c')}`,
        { credentials: 'include' },
      );
    });

    it('propagates typed errors from the shared API client', async () => {
      apiRequestMock.mockRejectedValue(new Error('Booking not found'));
      await expect(getMyBookingApi('missing')).rejects.toThrow('Booking not found');
    });
  });

  describe('cancelMyBookingApi', () => {
    it('forwards reason and returns the slimmed status/requiresApproval shape', async () => {
      cancelMyBookingMock.mockResolvedValue({
        status: 'CANCELLED',
        requiresApproval: false,
        extra: 'ignored',
      });
      await expect(cancelMyBookingApi('b1', 'conflict')).resolves.toEqual({
        status: 'CANCELLED',
        requiresApproval: false,
      });
      expect(cancelMyBookingMock).toHaveBeenCalledWith('b1', { reason: 'conflict' });
    });

    it('omits the reason key when not provided', async () => {
      cancelMyBookingMock.mockResolvedValue({ status: 'CANCEL_REQUESTED', requiresApproval: true });
      await cancelMyBookingApi('b1');
      expect(cancelMyBookingMock).toHaveBeenCalledWith('b1', { reason: undefined });
    });
  });

  describe('rescheduleMyBookingApi', () => {
    it('forwards newScheduledAt and the optional newDurationMins', async () => {
      rescheduleMyBookingMock.mockResolvedValue({ booking: { id: 'b1' } });
      await rescheduleMyBookingApi('b1', '2026-06-30T10:00:00.000Z', 60);
      expect(rescheduleMyBookingMock).toHaveBeenCalledWith('b1', {
        newScheduledAt: '2026-06-30T10:00:00.000Z',
        newDurationMins: 60,
      });
    });

    it('passes undefined for newDurationMins when omitted', async () => {
      rescheduleMyBookingMock.mockResolvedValue({ booking: { id: 'b1' } });
      await rescheduleMyBookingApi('b1', '2026-06-30T10:00:00.000Z');
      expect(rescheduleMyBookingMock).toHaveBeenCalledWith('b1', {
        newScheduledAt: '2026-06-30T10:00:00.000Z',
        newDurationMins: undefined,
      });
    });
  });

  describe('clientLogoutApi', () => {
    it('sends logout through the shared request client with a bounded signal', async () => {
      apiRequestMock.mockResolvedValue(undefined);
      await expect(clientLogoutApi()).resolves.toBeUndefined();
      expect(apiRequestMock).toHaveBeenCalledWith('/public/auth/logout', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({}),
        signal: expect.any(AbortSignal),
      });
    });

    it('aborts and rejects logout when the revocation request hangs', async () => {
      vi.useFakeTimers();
      let requestSignal: AbortSignal | undefined;
      apiRequestMock.mockImplementation((_path: string, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          requestSignal?.addEventListener('abort', () => reject(requestSignal?.reason), { once: true });
        });
      });

      const request = expect(clientLogoutApi()).rejects.toMatchObject({ name: 'TimeoutError' });
      await vi.advanceTimersByTimeAsync(10_000);

      await request;
      expect(requestSignal?.aborted).toBe(true);
    });
  });

  describe('clientResetPasswordApi', () => {
    it('forwards sessionToken and newPassword to the api-client', async () => {
      clientResetPasswordMock.mockResolvedValue(undefined);
      await clientResetPasswordApi({ sessionToken: 'tok123', newPassword: 'NewSecret1' });
      expect(clientResetPasswordMock).toHaveBeenCalledWith({
        sessionToken: 'tok123',
        newPassword: 'NewSecret1',
      });
    });
  });
});
