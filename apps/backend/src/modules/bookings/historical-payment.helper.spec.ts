import { mapHistoricalPayment } from './historical-payment.helper';

describe('mapHistoricalPayment', () => {
  it.each([
    ['paid', 'paid'],
    ['PAID', 'paid'],
    ['not_paid', 'not_paid'],
    ['pending', 'pending'],
    ['canceled', 'canceled'],
    ['unexpected', 'unknown'],
    [null, 'unknown'],
  ] as const)('normalizes source status %p to %s', (source, expected) => {
    expect(mapHistoricalPayment({ paymentStatus: source, paidAmount: '0.0000' }, 'CONFIRMED').status)
      .toBe(expected);
  });

  it('converts the source SAR decimal amount to integer halalas', () => {
    expect(mapHistoricalPayment(
      { paymentStatus: 'paid', paymentMethod: 'local', paidAmount: '200.5000' },
      'CONFIRMED',
    )).toEqual({
      status: 'paid',
      amount: 20050,
      method: 'local',
      requiresReview: false,
    });
  });

  it.each(['CANCELLED', 'EXPIRED', 'NO_SHOW'])(
    'marks a paid %s booking for review',
    (bookingStatus) => {
      expect(mapHistoricalPayment(
        { paymentStatus: 'paid', paidAmount: '300.0000' },
        bookingStatus,
      ).requiresReview).toBe(true);
    },
  );

  it('does not mark non-paid source states for revenue review', () => {
    expect(mapHistoricalPayment(
      { paymentStatus: 'not_paid', paidAmount: '20.0000' },
      'CANCELLED',
    ).requiresReview).toBe(false);
  });

  // Regression: BK-LIST-500 — a malformed historical row where booking.status is
  // missing must NOT crash the dashboard list. Without the guard, `.toUpperCase()`
  // on undefined throws "Cannot read properties of undefined" and 500s the route.
  it.each([undefined, null, '' as unknown as string])(
    'does not throw when bookingStatus is %p',
    (bookingStatus) => {
      expect(() => mapHistoricalPayment(
        { paymentStatus: 'paid', paidAmount: '200' },
        bookingStatus as unknown as string,
      )).not.toThrow();
    },
  );

  it('treats missing bookingStatus the same as a non-CONFIRMED status for review', () => {
    expect(mapHistoricalPayment(
      { paymentStatus: 'paid', paidAmount: '200' },
      undefined as unknown as string,
    ).requiresReview).toBe(true);
  });
});
