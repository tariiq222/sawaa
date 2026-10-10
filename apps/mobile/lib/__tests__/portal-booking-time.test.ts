import type { PortalBookingRow } from '@/services/client/portal';
import { nextPortalBooking, portalBookingInstant } from '../portal-booking-time';

const row = (overrides: Partial<PortalBookingRow> = {}): PortalBookingRow => ({
  id: 'booking-1', date: '2026-10-09', startTime: '16:00', endTime: '17:00', status: 'confirmed',
  type: 'in_person', zoomJoinUrl: null, employee: null, service: null, ...overrides,
});

it.each([
  ['2026-10-09T13:00:00Z', '2026-10-09T13:00:00.000Z'],
  ['2026-10-09T16:00:00+03:00', '2026-10-09T13:00:00.000Z'],
])('preserves the canonical instant %s regardless of device timezone', (scheduledAt, expected) => {
  expect(portalBookingInstant(row({ scheduledAt }))).toBe(expected);
});

it('converts a legacy midnight Riyadh wall time into the previous UTC date', () => {
  expect(portalBookingInstant(row({ date: '2026-10-10', startTime: '01:30' }))).toBe('2026-10-09T22:30:00.000Z');
});

it.each([
  { scheduledAt: 'not-a-date' },
  { scheduledAt: '2026-10-09T16:00:00' },
  { date: '2026-02-30' },
  { date: '2026-10-09', startTime: '25:00' },
  { date: null, startTime: null },
])('rejects an invalid or ambiguous appointment timestamp %j', (invalid) => {
  expect(portalBookingInstant(row(invalid as Partial<PortalBookingRow>))).toBeNull();
});

it('excludes an ended malformed row even when its start is future', () => {
  const booking = row({ scheduledAt: '2026-10-09T13:00:00Z', endsAt: '2026-10-09T11:00:00Z' });
  expect(nextPortalBooking([booking], Date.parse('2026-10-09T12:00:00Z'))).toBeNull();
});

it('does not mutate cached response order while selecting the nearest future booking', () => {
  const rows = [row({ id: 'later', scheduledAt: '2026-10-09T14:00:00Z' }), row({ id: 'nearest', scheduledAt: '2026-10-09T13:00:00Z' })];
  expect(nextPortalBooking(rows, Date.parse('2026-10-09T12:00:00Z'))?.id).toBe('nearest');
  expect(rows.map((booking) => booking.id)).toEqual(['later', 'nearest']);
});
