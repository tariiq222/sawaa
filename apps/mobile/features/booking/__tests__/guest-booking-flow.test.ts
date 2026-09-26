import { bookingStepPath, decodeBookingReturn, encodeBookingReturn } from '../guest-booking-flow';

describe('guest booking continuation', () => {
  it('keeps guests in public booking steps until review', () => {
    expect(bookingStepPath('schedule', false)).toBe('/public-booking/schedule');
    expect(bookingStepPath('confirm', false)).toBe('/public-booking/confirm');
    expect(bookingStepPath('schedule', true)).toBe('/(client)/booking/schedule');
  });

  it('carries the selected appointment through login and OTP', () => {
    const booking = {
      serviceId: 'service-1', employeeId: 'employee-1', branchId: 'branch-1',
      deliveryType: 'online' as const, scheduledAt: '2026-10-01T10:00:00.000Z',
      durationOptionId: 'duration-1', amount: '45000', currency: 'SAR',
    };
    expect(decodeBookingReturn(encodeBookingReturn(booking))).toEqual(booking);
  });

  it('rejects incomplete or malformed return payloads', () => {
    expect(decodeBookingReturn('{')).toBeNull();
    expect(decodeBookingReturn(JSON.stringify({ serviceId: 'service-1' }))).toBeNull();
    expect(decodeBookingReturn(JSON.stringify({
      serviceId: 'a', employeeId: 'b', branchId: 'c', deliveryType: 'other',
      scheduledAt: 'bad', amount: '0', currency: 'SAR',
    }))).toBeNull();
  });
});
