import { shouldBypassCsrf } from './csrf-policy';

describe('shouldBypassCsrf', () => {
  it.each<[boolean, string, boolean]>([
    // [expected bypass, path, hasClientSessionCookie]
    // No client session cookie: legacy prefix rules
    [true, '/api/v1/dashboard/bookings', false],
    [true, '/api/v1/auth/refresh', false],
    [true, '/api/v1/mobile/client/bookings', false],
    [true, '/api/v1/mobile/employee/schedule', false],
    [true, '/api/v1/client/bookings', false],
    [false, '/api/v1/public/me', false],
    [false, '/api/v1/public/payments/init', false],
    [false, '/api/v1/public/bookings', false],
    [false, '/api/v1/public/payment-webhook', false],
    [false, '/api/v1/public/payments/webhook/unregistered-child', false],
    // Client session cookie present: enforce everywhere except machine callers
    [false, '/api/v1/mobile/client/bookings', true],
    [false, '/api/v1/client/bookings', true],
    [false, '/api/v1/public/me', true],
    [true, '/api/v1/dashboard/bookings', true],
    [true, '/api/v1/auth/login', true],
    [true, '/api/v1/auth/refresh', true],
    // Machine callers always bypass, cookie or not
    [true, '/api/v1/public/payments/webhook', false],
    [true, '/api/v1/public/payments/webhook', true],
    [true, '/api/v1/public/sms/webhooks/UNIFONIC', false],
    [true, '/api/v1/public/sms/webhooks/UNIFONIC', true],
    [true, '/api/v1/public/health/live', false],
    [true, '/api/v1/public/health/live', true],
    [true, '/api/v1/public/metrics', false],
    [true, '/api/v1/public/metrics', true],
  ])('returns %s for %s (cookie=%s)', (expected, path, hasClientSessionCookie) => {
    expect(shouldBypassCsrf({ path, hasClientSessionCookie })).toBe(expected);
  });
});
