import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const PLATFORM_TZ = 'Asia/Riyadh';

/** Advance a calendar day without consulting the server's local timezone. */
function nextDay(day: string): string {
  const calendar = new Date(`${day}T00:00:00Z`);
  calendar.setUTCDate(calendar.getUTCDate() + 1);
  return calendar.toISOString().slice(0, 10);
}

export function todayRangeInTz(tz = PLATFORM_TZ): { start: Date; end: Date } {
  const day = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
  return dateRangeInTz(day, day, tz);
}

export function startOfMonthInTz(tz = PLATFORM_TZ): { start: Date; end: Date } {
  const first = `${formatInTimeZone(new Date(), tz, 'yyyy-MM')}-01`;
  const calendar = new Date(`${first}T00:00:00Z`);
  calendar.setUTCMonth(calendar.getUTCMonth() + 1);
  return {
    start: fromZonedTime(`${first}T00:00:00`, tz),
    end: fromZonedTime(`${calendar.toISOString().slice(0, 10)}T00:00:00`, tz),
  };
}

/** [start, end): optional dates default to today, with exclusive next-day end. */
export function dateRangeInTz(from?: string, to?: string, tz = PLATFORM_TZ): { start: Date; end: Date } {
  const first = from ?? formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
  const last = to ?? first;
  return {
    start: fromZonedTime(`${first}T00:00:00`, tz),
    end: fromZonedTime(`${nextDay(last)}T00:00:00`, tz),
  };
}

/**
 * Parse a yyyy-MM-dd / ISO date string into the *inclusive* start of that
 * calendar day in Asia/Riyadh (= 00:00:00 +03:00). Returns undefined when
 * the input is missing or unparseable. Use for `gte` filters where the
 * caller intends "from this date onward".
 */
export function startOfDayInTz(value?: string): Date | undefined {
  if (!value) return undefined;
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? undefined : fallback;
  }
  // Asia/Riyadh has a fixed +03:00 offset (no DST), so an explicit offset
  // gives the deterministic UTC instant of midnight Riyadh-local.
  return new Date(`${datePart}T00:00:00+03:00`);
}

/**
 * Parse a yyyy-MM-dd / ISO date string into the *inclusive* end of that
 * calendar day in Asia/Riyadh (= 23:59:59.999 +03:00). Returns undefined
 * when the input is missing or unparseable. Use for `lte` filters so the
 * range covers the entire end day rather than truncating at 00:00 UTC.
 */
export function endOfDayInTz(value?: string): Date | undefined {
  if (!value) return undefined;
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const fallback = new Date(value);
    if (Number.isNaN(fallback.getTime())) return undefined;
    fallback.setUTCHours(23, 59, 59, 999);
    return fallback;
  }
  return new Date(`${datePart}T23:59:59.999+03:00`);
}
