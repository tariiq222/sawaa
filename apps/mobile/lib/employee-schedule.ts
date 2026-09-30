import type { Booking } from '@/types/models';
import { resolveDeliveryTypeFromLegacyResponse, type DeliveryType } from '@/types/booking-enums';

/** Local calendar date as `YYYY-MM-DD` (the format `useEmployeeDayBookings` takes). */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses `YYYY-MM-DD` as a local date at noon, so time zones never shift the day. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12);
}

/** The seven days (Sunday to Saturday, matching `days.0`..`days.6`) of the week containing `key`. */
export function getWeekDays(key: string): { key: string; date: Date; dayOfWeek: number }[] {
  const anchor = fromDateKey(key);
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay(), 12);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12);
    return { key: toDateKey(date), date, dayOfWeek: index };
  });
}

/** Moves a date key by whole days (used for week paging). */
export function shiftDateKey(key: string, days: number): string {
  const date = fromDateKey(key);
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12));
}

function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Appointment length in minutes from the real fields only; null when none is available. */
export function getAppointmentDurationMins(
  booking: Pick<Booking, 'durationMins' | 'service' | 'startTime' | 'endTime'>,
): number | null {
  if (booking.durationMins && booking.durationMins > 0) return booking.durationMins;
  if (booking.service?.duration && booking.service.duration > 0) return booking.service.duration;
  const start = toMinutes(booking.startTime);
  const end = toMinutes(booking.endTime);
  return start !== null && end !== null && end > start ? end - start : null;
}

/** Delivery channel of a list/detail booking, tolerating legacy payloads that put it in `type`. */
export function getBookingDelivery(booking: Pick<Booking, 'deliveryType' | 'type'>): DeliveryType {
  return resolveDeliveryTypeFromLegacyResponse(booking.deliveryType, booking.type);
}

/** Service name in the UI language, falling back to the other language; null when unknown. */
export function getServiceName(booking: Pick<Booking, 'service'>, isRTL: boolean): string | null {
  const service = booking.service;
  if (!service) return null;
  const primary = isRTL ? service.nameAr : service.nameEn;
  const secondary = isRTL ? service.nameEn : service.nameAr;
  return primary || secondary || null;
}
