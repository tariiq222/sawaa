import {
  mapEmployeeClientHistoryRow,
  type EmployeeClientHistoryRow,
} from '../services/clients';
import { BOOKING_STATUSES } from '../types/booking-enums';

/**
 * Regression guard for the status-normalisation bug found during MNT-21.
 *
 * `services/clients.ts` kept its own nine-value allowlist that was missing
 * `deposit_paid`, so `normalizeEnum` silently rewrote a DEPOSIT_PAID row to
 * `pending`. Employees saw a paid deposit as an unpaid booking. The list now
 * comes from `BOOKING_STATUSES`, and this test fails if any wire status stops
 * surviving normalisation.
 */
function row(status: string): EmployeeClientHistoryRow {
  return {
    id: 'booking-1',
    clientId: 'client-1',
    employeeId: 'employee-1',
    bookingType: 'INDIVIDUAL',
    deliveryType: 'IN_PERSON',
    status,
    scheduledAt: '2026-11-20T10:00:00.000Z',
    durationMins: 50,
  };
}

describe('employee client history status normalisation', () => {
  it('keeps every status the backend can send', () => {
    for (const status of BOOKING_STATUSES) {
      expect(mapEmployeeClientHistoryRow(row(status.toUpperCase())).status).toBe(status);
    }
  });

  it('keeps deposit_paid instead of collapsing it to pending', () => {
    // The concrete bug: this returned 'pending' before the fix.
    expect(mapEmployeeClientHistoryRow(row('DEPOSIT_PAID')).status).toBe('deposit_paid');
  });

  it('still falls back for a status the backend does not send', () => {
    expect(mapEmployeeClientHistoryRow(row('SOMETHING_ELSE')).status).toBe('pending');
  });
});
