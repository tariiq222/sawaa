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
