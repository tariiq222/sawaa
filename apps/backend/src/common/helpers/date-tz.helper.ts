const PLATFORM_TZ = 'Asia/Riyadh';

export function todayRangeInTz(tz = PLATFORM_TZ): { start: Date; end: Date } {
  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const start = new Date(nowInTz);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function startOfMonthInTz(tz = PLATFORM_TZ): { start: Date; end: Date } {
  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const start = new Date(nowInTz);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

/**
 * Builds a [start, end) range from optional yyyy-MM-dd date strings.
 * `from` defaults to today's start; `to` defaults to `from`'s day.
 * `end` is exclusive (start of the day AFTER `to`).
 */
export function dateRangeInTz(
  from?: string,
  to?: string,
  tz = PLATFORM_TZ,
): { start: Date; end: Date } {
  const todayRange = todayRangeInTz(tz);
  const start = from ? new Date(`${from}T00:00:00`) : todayRange.start;
  const toBase = to ? new Date(`${to}T00:00:00`) : new Date(start);
  const end = new Date(toBase);
  end.setDate(end.getDate() + 1);
  return { start, end };
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
