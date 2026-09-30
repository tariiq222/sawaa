import {
  getAppointmentDurationMins,
  getBookingDelivery,
  getServiceName,
  getWeekDays,
  shiftDateKey,
  toDateKey,
} from '../employee-schedule';

describe('employee schedule helpers', () => {
  it('builds the Sunday to Saturday week around a date', () => {
    // 2026-09-30 is a Wednesday.
    const week = getWeekDays('2026-09-30');
    expect(week.map((day) => day.key)).toEqual([
      '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03',
    ]);
    expect(week.map((day) => day.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('crosses month and year boundaries when paging by week', () => {
    expect(shiftDateKey('2026-12-30', 7)).toBe('2027-01-06');
    expect(shiftDateKey('2026-03-01', -7)).toBe('2026-02-22');
    expect(getWeekDays('2027-01-01')[0].key).toBe('2026-12-27');
  });

  it('formats local dates without a UTC shift', () => {
    expect(toDateKey(new Date(2026, 8, 5, 0, 30))).toBe('2026-09-05');
  });

  it('takes duration from the booking, then the service, then the time range', () => {
    expect(getAppointmentDurationMins({ durationMins: 50, startTime: '10:00', endTime: '10:45' })).toBe(50);
    expect(getAppointmentDurationMins({ service: { duration: 40 }, startTime: '10:00', endTime: '10:45' })).toBe(40);
    expect(getAppointmentDurationMins({ startTime: '10:00', endTime: '10:45' })).toBe(45);
    expect(getAppointmentDurationMins({ startTime: '', endTime: '' })).toBeNull();
  });

  it('resolves delivery from deliveryType first, then the legacy type', () => {
    expect(getBookingDelivery({ deliveryType: 'online', type: 'individual' })).toBe('online');
    expect(getBookingDelivery({ deliveryType: null, type: 'online' })).toBe('online');
    expect(getBookingDelivery({ deliveryType: null, type: 'individual' })).toBe('in_person');
  });

  it('picks the service name by language and never invents one', () => {
    const booking = { service: { nameAr: 'استشارة', nameEn: 'Consultation' } };
    expect(getServiceName(booking, true)).toBe('استشارة');
    expect(getServiceName(booking, false)).toBe('Consultation');
    expect(getServiceName({ service: { nameAr: 'استشارة' } }, false)).toBe('استشارة');
    expect(getServiceName({}, true)).toBeNull();
  });
});
