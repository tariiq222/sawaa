import { shouldBypassCsrf } from './csrf-policy';

describe('shouldBypassCsrf', () => {
  it.each([
    [true, '/api/v1/dashboard/bookings'],
    [true, '/api/v1/auth/refresh'],
    [true, '/api/v1/mobile/client/bookings'],
    [true, '/api/v1/mobile/employee/schedule'],
    [true, '/api/v1/public/payments/webhook'],
    [true, '/api/v1/public/sms/webhooks/UNIFONIC'],
    [true, '/api/v1/public/health/live'],
    [true, '/api/v1/public/metrics'],
    [false, '/api/v1/public/payments/init'],
    [false, '/api/v1/public/bookings'],
    [false, '/api/v1/public/payment-webhook'],
    [false, '/api/v1/public/payments/webhook/unregistered-child'],
  ])('returns %s for %s', (expected, path) => {
    expect(shouldBypassCsrf(path)).toBe(expected);
  });
});
