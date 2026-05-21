/**
 * Timezone utilities for Sawa Family Counseling.
 *
 * مركز سواء operates exclusively in Asia/Riyadh (+03:00, no DST).
 * The DB stores all timestamps as UTC instants. These helpers bridge
 * between wall-clock Riyadh time (used by therapists / admin) and UTC
 * instants (stored/compared in the DB), regardless of the server's local TZ.
 *
 * Use `date-fns-tz` for all TZ-aware operations — never `setHours`/`getHours`
 * on a wall-clock value, as those methods respect the *process* TZ, which may
 * differ from the server host's TZ on any deployment.
 */

import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/** The business timezone — never change without a migration. */
export const BUSINESS_TZ = 'Asia/Riyadh';

/**
 * Returns the current UTC instant as a JS Date.
 * This is equivalent to `new Date()` but named explicitly to signal intent:
 * callers that need "now" for instant comparisons should use this, not
 * build wall-clock components with `setHours`.
 */
export function nowInBusinessTz(): Date {
  return new Date();
}

/**
 * Converts a wall-clock Riyadh date+time pair into a UTC Date.
 *
 * @param dateYmd  - Calendar date in YYYY-MM-DD format (Riyadh wall-clock)
 * @param timeHm   - Time in HH:mm format (Riyadh wall-clock)
 * @returns        UTC Date representing the same instant
 *
 * @example
 * parseLocalDateTime('2026-06-15', '14:30')
 * // → 2026-06-15T11:30:00.000Z  (UTC = Riyadh − 3 h)
 */
export function parseLocalDateTime(dateYmd: string, timeHm: string): Date {
  // fromZonedTime interprets the wall-clock string as being in the given TZ
  // and returns the equivalent UTC instant, regardless of process.env.TZ.
  return fromZonedTime(`${dateYmd}T${timeHm}:00`, BUSINESS_TZ);
}

/**
 * Alias for parseLocalDateTime — accepts the same params and returns the
 * same UTC Date. Named to match the check-availability handler vocabulary.
 */
export function combineYmdAndHmInBusinessTz(ymd: string, hm: string): Date {
  return parseLocalDateTime(ymd, hm);
}

/**
 * Returns the HH:mm representation of a UTC Date in Asia/Riyadh wall-clock.
 *
 * @example
 * formatToBusinessHHmm(new Date('2026-06-15T11:30:00Z'))
 * // → '14:30'
 */
export function formatToBusinessHHmm(d: Date): string {
  return formatInTimeZone(d, BUSINESS_TZ, 'HH:mm');
}

/**
 * Returns the YYYY-MM-DD date string for a UTC Date in Asia/Riyadh wall-clock.
 *
 * @example
 * formatToBusinessYmd(new Date('2026-06-14T22:30:00Z'))
 * // → '2026-06-15'  (midnight+3h crosses calendar day)
 */
export function formatToBusinessYmd(d: Date): string {
  return formatInTimeZone(d, BUSINESS_TZ, 'yyyy-MM-dd');
}
