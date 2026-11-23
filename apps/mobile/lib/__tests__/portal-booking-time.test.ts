import type { PortalBookingRow } from '@/services/client/portal';
import { isPortalBookingLive, nextPortalBooking, portalBookingEndInstant, portalBookingInstant } from '../portal-booking-time';

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

describe('live bookings', () => {
  const live = row({ id: 'live', scheduledAt: '2026-10-09T11:30:00Z', endsAt: '2026-10-09T12:30:00Z' });
  const now = Date.parse('2026-10-09T12:00:00Z');

  it('flags a booking as live only between start and end', () => {
    expect(isPortalBookingLive(live, now)).toBe(true);
    expect(isPortalBookingLive(live, Date.parse('2026-10-09T11:29:59Z'))).toBe(false);
    expect(isPortalBookingLive(live, Date.parse('2026-10-09T12:30:00Z'))).toBe(false);
  });

  it('prefers the in-progress booking over a nearer-looking future one', () => {
    const future = row({ id: 'future', scheduledAt: '2026-10-09T12:10:00Z', endsAt: '2026-10-09T13:00:00Z' });
    expect(nextPortalBooking([future, live], now)?.id).toBe('live');
  });

  it('drops the booking once it has ended', () => {
    expect(nextPortalBooking([live], Date.parse('2026-10-09T12:31:00Z'))).toBeNull();
  });

  it('derives the end from the Riyadh wall clock when endsAt is missing', () => {
    const legacy = row({ date: '2026-10-09', startTime: '16:00', endTime: '17:00' });
    expect(portalBookingEndInstant(legacy)).toBe('2026-10-09T14:00:00.000Z');
    expect(isPortalBookingLive(legacy, Date.parse('2026-10-09T13:30:00Z'))).toBe(true);
    expect(isPortalBookingLive(legacy, Date.parse('2026-10-09T14:00:00Z'))).toBe(false);
  });
});

describe('nextPortalBooking status filter (documents an implicit contract)', () => {
  // The home "up next" card only ever receives these three statuses. Any other
  // status is filtered out here, so widening this list is what makes a new pill
  // reachable on the client home screen. If that ever changes on purpose, this
  // test is the reminder that UpNextCard's label coverage now applies.
  const allowed = ['pending', 'confirmed', 'deposit_paid'];
  const excluded = [
    'pending_group_fill',
    'awaiting_payment',
    'completed',
    'cancelled',
    'cancel_requested',
    'no_show',
    'expired',
  ];

  it('passes the active statuses through', () => {
    for (const status of allowed) {
      const item = row({ id: status, status: status.toUpperCase() });
      expect(nextPortalBooking([item], Date.parse('2026-10-09T12:00:00Z'))?.id).toBe(status);
    }
  });

  it('filters out every other status', () => {
    for (const status of excluded) {
      const item = row({ id: status, status: status.toUpperCase() });
      expect(nextPortalBooking([item], Date.parse('2026-10-09T12:00:00Z'))).toBeNull();
    }
  });
});
