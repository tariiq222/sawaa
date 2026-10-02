import { bookingStep, clinicBookingEntry, stepsAfterSkip } from '../booking-entry';

describe('clinicBookingEntry', () => {
  it('sends a DIRECT clinic to the therapist step with its internal service', () => {
    expect(clinicBookingEntry({ bookingMode: 'DIRECT', directServiceId: 's1' }))
      .toEqual({ kind: 'therapist', serviceId: 's1', steps: 3 });
  });
  it('reports a DIRECT clinic without its internal service as misconfigured', () => {
    expect(clinicBookingEntry({ bookingMode: 'DIRECT', directServiceId: null })).toEqual({ kind: 'misconfigured' });
  });
  it('sends a SERVICES clinic to the service step', () => {
    expect(clinicBookingEntry({ bookingMode: 'SERVICES', directServiceId: null })).toEqual({ kind: 'service', steps: 4 });
  });
});

describe('bookingStep', () => {
  it('numbers a 4-step flow', () => {
    expect(bookingStep('service', '4')).toEqual({ step: 1, total: 4 });
    expect(bookingStep('therapist', '4')).toEqual({ step: 2, total: 4 });
    expect(bookingStep('time', '4')).toEqual({ step: 3, total: 4 });
    expect(bookingStep('confirm', '4')).toEqual({ step: 4, total: 4 });
  });
  it('numbers a 3-step flow', () => {
    expect(bookingStep('therapist', '3')).toEqual({ step: 1, total: 3 });
    expect(bookingStep('time', '3')).toEqual({ step: 2, total: 3 });
    expect(bookingStep('confirm', '3')).toEqual({ step: 3, total: 3 });
  });
  it('falls back to the legacy two steps', () => {
    expect(bookingStep('time')).toEqual({ step: 1, total: 2 });
    expect(bookingStep('confirm', 'abc')).toEqual({ step: 2, total: 2 });
    expect(bookingStep('time', '2')).toEqual({ step: 1, total: 2 });
  });
});

describe('stepsAfterSkip', () => {
  it('drops the skipped therapist step from the total', () => {
    expect(stepsAfterSkip('4')).toBe('3');
    expect(stepsAfterSkip('3')).toBe('2');
    expect(stepsAfterSkip(undefined)).toBeUndefined();
  });
});
