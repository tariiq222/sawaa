import type { PortalBookingRow } from '@/services/client/portal';
import { APPOINTMENT_TIME_ZONE } from './session-format';

/** Canonical timestamps are instants; legacy portal fields are Riyadh wall time. */
export function portalBookingInstant(booking: PortalBookingRow): string | null {
  if (booking.scheduledAt) {
    if (!/(Z|[+-]\d{2}:\d{2})$/i.test(booking.scheduledAt)) return null;
    const instant = new Date(booking.scheduledAt);
    return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date ?? '') || !/^\d{2}:\d{2}$/.test(booking.startTime ?? '')) return null;
  const [year, month, day] = booking.date.split('-').map(Number);
  const [hour, minute] = booking.startTime.split(':').map(Number);
  const wallAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (Number.isNaN(wallAsUtc.getTime()) || wallAsUtc.toISOString().slice(0, 16) !== `${booking.date}T${booking.startTime}`) return null;
  // Derive the timezone offset from Intl, not the device timezone or a fixed hour shift.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APPOINTMENT_TIME_ZONE, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(wallAsUtc);
  const part = (name: Intl.DateTimeFormatPartTypes) => Number(parts.find((value) => value.type === name)?.value);
  const represented = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return new Date(wallAsUtc.getTime() - (represented - wallAsUtc.getTime())).toISOString();
}

export function nextPortalBooking(bookings: PortalBookingRow[], now: number): PortalBookingRow | null {
  let next: PortalBookingRow | null = null;
  let nextAt = Infinity;
  for (const booking of bookings) {
    if (!['pending', 'confirmed', 'deposit_paid'].includes(booking.status?.toLowerCase())) continue;
    const instant = portalBookingInstant(booking);
    if (!instant) continue;
    const at = new Date(instant).getTime();
    if (booking.endsAt && new Date(booking.endsAt).getTime() <= now) continue;
    if (at > now && at < nextAt) { next = booking; nextAt = at; }
  }
  return next;
}
