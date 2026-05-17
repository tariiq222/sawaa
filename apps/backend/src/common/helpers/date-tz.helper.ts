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
