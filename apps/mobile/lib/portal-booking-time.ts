import type { PortalBookingRow } from '@/services/client/portal';
import { APPOINTMENT_TIME_ZONE } from './session-format';

/** Canonical timestamps are instants; legacy portal fields are Riyadh wall time. */
function riyadhWallInstant(date: string | null | undefined, time: string | null | undefined): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !/^\d{2}:\d{2}$/.test(time ?? '')) return null;
  const [year, month, day] = date!.split('-').map(Number);
  const [hour, minute] = time!.split(':').map(Number);
  const wallAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (Number.isNaN(wallAsUtc.getTime()) || wallAsUtc.toISOString().slice(0, 16) !== `${date}T${time}`) return null;
  // Derive the timezone offset from Intl, not the device timezone or a fixed hour shift.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APPOINTMENT_TIME_ZONE, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(wallAsUtc);
  const part = (name: Intl.DateTimeFormatPartTypes) => Number(parts.find((value) => value.type === name)?.value);
  const represented = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return new Date(wallAsUtc.getTime() - (represented - wallAsUtc.getTime())).toISOString();
}

/** Canonical timestamps are instants; legacy portal fields are Riyadh wall time. */
export function portalBookingInstant(booking: PortalBookingRow): string | null {
  if (booking.scheduledAt) {
    if (!/(Z|[+-]\d{2}:\d{2})$/i.test(booking.scheduledAt)) return null;
    const instant = new Date(booking.scheduledAt);
    return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
  }
  return riyadhWallInstant(booking.date, booking.startTime);
}

/** End instant from `endsAt`, or from the Riyadh wall-clock date and end time when `endsAt` is missing. */
export function portalBookingEndInstant(booking: PortalBookingRow): string | null {
  if (booking.endsAt) {
    const instant = new Date(booking.endsAt);
    return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
  }
  return riyadhWallInstant(booking.date, booking.endTime);
}

/** True while the session has started and not yet ended. */
export function isPortalBookingLive(booking: PortalBookingRow, now: number): boolean {
  const start = portalBookingInstant(booking);
  const end = portalBookingEndInstant(booking);
  if (!start || !end) return false;
  return new Date(start).getTime() <= now && now < new Date(end).getTime();
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'deposit_paid'];

/** An in-progress booking wins; otherwise the nearest future booking. */
export function nextPortalBooking(bookings: PortalBookingRow[], now: number): PortalBookingRow | null {
  let live: PortalBookingRow | null = null;
  let liveAt = Infinity;
  let next: PortalBookingRow | null = null;
  let nextAt = Infinity;
  for (const booking of bookings) {
    if (!ACTIVE_STATUSES.includes(booking.status?.toLowerCase())) continue;
    const instant = portalBookingInstant(booking);
    if (!instant) continue;
    const at = new Date(instant).getTime();
    if (booking.endsAt && new Date(booking.endsAt).getTime() <= now) continue;
    if (isPortalBookingLive(booking, now)) {
      if (at < liveAt) { live = booking; liveAt = at; }
    } else if (at > now && at < nextAt) { next = booking; nextAt = at; }
  }
  return live ?? next;
}
