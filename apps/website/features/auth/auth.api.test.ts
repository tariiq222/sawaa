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
}));

vi.mock('@/lib/api-base', () => ({
  getApiBase: getApiBaseMock,
}));

const fetchMock = vi.fn();
beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
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
    getApiBaseMock.mockReturnValue('http://api.local/api/v1');
  });

  describe('initialisation', () => {
    it('sets the api base urls on the api-client modules exactly once across calls', async () => {
      getMeMock.mockResolvedValue(fakeProfile);
      await getMeApi();
      await clientLogoutApi();
      expect(setClientBaseUrlMock).toHaveBeenCalledTimes(1);
      expect(setMeBaseUrlMock).toHaveBeenCalledTimes(1);
      expect(setClientBaseUrlMock).toHaveBeenCalledWith('http://api.local/api/v1');
      expect(setMeBaseUrlMock).toHaveBeenCalledWith('http://api.local/api/v1');
    });

    it('exposes getMeApi that calls through to the api-client getMe', async () => {
      getMeMock.mockResolvedValue(fakeProfile);
      await getMeApi();
      expect(getMeMock).toHaveBeenCalledTimes(1);
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
      getMeMock.mockResolvedValue(fakeProfile);
      await expect(getMeApi()).resolves.toEqual(fakeProfile);
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
    it('hits the public/me/bookings/{id} endpoint with credentials and unwraps { data } envelope', async () => {
      const booking = { id: 'b1', status: 'CONFIRMED' };
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: booking }) });
      await expect(getMyBookingApi('b1')).resolves.toEqual(booking);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://api.local/api/v1/public/me/bookings/b1');
      expect(init.credentials).toBe('include');
    });

    it('passes through a bare booking payload (no envelope)', async () => {
      const booking = { id: 'b2' };
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(booking) });
      await expect(getMyBookingApi('b2')).resolves.toEqual(booking);
    });

    it('URL-encodes the booking id', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'b3' }) });
      await getMyBookingApi('a/b c');
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain(encodeURIComponent('a/b c'));
      expect(url).not.toContain('a/b c');
    });

    it('throws the backend message on a 4xx response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Booking not found' }),
      });
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
    it('awaits the api-client logout call', async () => {
      clientLogoutMock.mockResolvedValue(undefined);
      await expect(clientLogoutApi()).resolves.toBeUndefined();
      expect(clientLogoutMock).toHaveBeenCalledTimes(1);
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
