import { formatTimeOfDay } from '@/lib/session-format';

export function formatConfirmTime(date: Date, isRTL: boolean): string {
  if (!Number.isFinite(date.getTime())) return '—';
  return formatTimeOfDay(date.toISOString(), isRTL) ?? '—';
}

export function formatConfirmDate(date: Date, isRTL: boolean): string {
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(isRTL ? 'ar-SA' : 'en-US', {
    calendar: 'gregory', day: 'numeric', month: 'short', year: 'numeric',
  }).format(date);
}
