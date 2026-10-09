export const APPOINTMENT_TIME_ZONE = 'Asia/Riyadh';

/** Date/time formatting shared by the appointment and group-session screens. */

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localeOf(isRTL: boolean): string {
  return isRTL ? 'ar-SA' : 'en-US';
}

/** Arabic uses the Gregorian calendar (ar-SA defaults to Umm al-Qura). */
function options(isRTL: boolean, base: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  return { ...base, timeZone: APPOINTMENT_TIME_ZONE, ...(isRTL ? { calendar: 'gregory' } : {}) };
}

/** Day number and short month for the date box, or null when the date is missing/invalid. */
export function formatDayMonth(iso: string | null | undefined, isRTL: boolean): { day: string; month: string } | null {
  const date = parse(iso);
  if (!date) return null;
  return {
    day: new Intl.DateTimeFormat(localeOf(isRTL), options(isRTL, { day: 'numeric' })).format(date),
    month: new Intl.DateTimeFormat(localeOf(isRTL), options(isRTL, { month: 'short' })).format(date),
  };
}

export function formatDayWeekday(iso: string | null | undefined, isRTL: boolean): { day: string; weekday: string } | null {
  const date = parse(iso);
  if (!date) return null;
  return {
    day: new Intl.DateTimeFormat(localeOf(isRTL), options(isRTL, { day: 'numeric' })).format(date),
    weekday: new Intl.DateTimeFormat(localeOf(isRTL), options(isRTL, { weekday: 'short' })).format(date),
  };
}

export function formatTimeOfDay(iso: string | null | undefined, isRTL: boolean): string | null {
  const date = parse(iso);
  if (!date) return null;
  return new Intl.DateTimeFormat(localeOf(isRTL), options(isRTL, { hour: 'numeric', minute: '2-digit' })).format(date);
}

export function formatLongDate(iso: string | null | undefined, isRTL: boolean): string | null {
  const date = parse(iso);
  if (!date) return null;
  return new Intl.DateTimeFormat(
    localeOf(isRTL),
    options(isRTL, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  ).format(date);
}

export function formatWeekdayDateTime(iso: string | null | undefined, isRTL: boolean): string | null {
  const date = parse(iso);
  if (!date) return null;
  return new Intl.DateTimeFormat(
    localeOf(isRTL),
    options(isRTL, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  ).format(date);
}

/** Integer halalas (number or numeric string) to a whole-riyal display string with the currency label. */
export function formatHalalasPrice(halalas: number | string, isRTL: boolean, currencyLabel: string): string {
  const value = Number(halalas);
  const safe = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat(localeOf(isRTL)).format(safe / 100)} ${currencyLabel}`;
}
