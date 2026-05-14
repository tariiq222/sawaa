import { getStatusLabel, STATUS_LABEL_MAP } from '../lib/status-helpers';
import { BookingStatus } from '../types/booking-enums';

describe('getStatusLabel', () => {
  it('maps all defined BookingStatus values correctly', () => {
    const statuses: BookingStatus[] = [
      'pending',
      'confirmed',
      'completed',
      'cancelled',
      'no_show',
      'expired',
      'pending_group_fill',
      'awaiting_payment',
      'cancel_requested',
    ];

    statuses.forEach((status) => {
      expect(getStatusLabel(status)).toBe(STATUS_LABEL_MAP[status]);
    });
  });

  it('maps cancelled to appointments.cancelledStatus', () => {
    expect(getStatusLabel('cancelled')).toBe('appointments.cancelledStatus');
  });

  it('maps no_show to appointments.noShow', () => {
    expect(getStatusLabel('no_show')).toBe('appointments.noShow');
  });

  it('maps expired to appointments.expired', () => {
    expect(getStatusLabel('expired')).toBe('appointments.expired');
  });

  it('falls back to appointments.completed for unknown status', () => {
    // @ts-ignore - testing runtime fallback
    expect(getStatusLabel('unknown_status')).toBe('appointments.completed');
  });

  it('verifies specific labels required by P0-4', () => {
    // These are the ones specifically mentioned in the audit
    expect(getStatusLabel('cancelled')).toBe('appointments.cancelledStatus');
    expect(getStatusLabel('no_show')).toBe('appointments.noShow');
  });
});
