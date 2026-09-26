import { authContinuationParams, authLoginHref, bookingStepPath, decodeBookingReturn, encodeBookingReturn } from '../guest-booking-flow';

describe('guest booking continuation', () => {
  it('keeps guests in public booking steps until review', () => {
    expect(bookingStepPath('schedule', false)).toBe('/public-booking/schedule');
    expect(bookingStepPath('confirm', false)).toBe('/public-booking/confirm');
    expect(bookingStepPath('schedule', true)).toBe('/(client)/booking/schedule');
  });

  it('carries the selected appointment through login and OTP', () => {
    const booking = {
      clinicId: 'clinic-1', serviceId: 'service-1', employeeId: 'employee-1', branchId: 'branch-1',
      deliveryType: 'online' as const, scheduledAt: '2026-10-01T10:00:00.000Z',
      durationOptionId: 'duration-1', amount: '45000', currency: 'SAR',
    };
    expect(decodeBookingReturn(encodeBookingReturn(booking))).toEqual(booking);
  });

  it('preserves both the booking draft and guarded route across auth branches', () => {
    expect(authContinuationParams('{"clinicId":"clinic-1"}', '/(client)/appointments'))
      .toEqual({ booking: '{"clinicId":"clinic-1"}', redirect: '/(client)/appointments' });
    expect(authContinuationParams(undefined, undefined)).toEqual({});
  });

  it('returns to login from password recovery with the same continuation', () => {
    expect(authLoginHref('draft-1', '/(client)/appointments')).toEqual({
      pathname: '/(auth)/login',
      params: { booking: 'draft-1', redirect: '/(client)/appointments' },
    });
  });

  it('preserves a zero-priced booking draft through guest auth continuation', () => {
    const booking = {
      serviceId: 'service-free', employeeId: 'employee-1', branchId: 'branch-1',
      deliveryType: 'in_person' as const, scheduledAt: '2026-10-01T10:00:00.000Z',
      durationOptionId: 'duration-free', amount: '0', currency: 'SAR',
    };
    const serialized = encodeBookingReturn(booking);

    expect(decodeBookingReturn(serialized)).toEqual(booking);
  });

  it('rejects incomplete or malformed return payloads', () => {
    expect(decodeBookingReturn('{')).toBeNull();
    expect(decodeBookingReturn(JSON.stringify({ serviceId: 'service-1' }))).toBeNull();
    for (const amount of ['-1', '1.5', 'NaN', 'Infinity', '9007199254740992', '']) {
      expect(decodeBookingReturn(JSON.stringify({
        serviceId: 'a', employeeId: 'b', branchId: 'c', deliveryType: 'in_person',
        scheduledAt: '2026-10-01T10:00:00.000Z', amount, currency: 'SAR',
      }))).toBeNull();
    }
    expect(decodeBookingReturn(JSON.stringify({
      serviceId: 'a', employeeId: 'b', branchId: 'c', deliveryType: 'other',
      scheduledAt: 'bad', amount: '0', currency: 'SAR',
    }))).toBeNull();
  });
});
