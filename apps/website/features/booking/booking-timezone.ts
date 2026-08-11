/**
 * Asia/Riyadh wall-time → UTC ISO-8601 conversion for client booking inputs.
 *
 * Riyadh is UTC+03:00 year-round (Saudi Arabia has no DST). The date/time
 * values a user picks in the reschedule dialog are wall time in the center's
 * timezone, so the conversion must NEVER run through the browser/process
 * local timezone — otherwise the instant shifts by however far the visitor's
 * device is from UTC+03:00. This helper treats the inputs as an explicit
 * wall time and applies the fixed +03:00 offset with pure arithmetic
 * (`Date.UTC` + `toISOString` never consult the local timezone).
 */

const RIYADH_UTC_OFFSET_MINUTES = 3 * 60; // UTC+03:00, fixed year-round

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/** Parse YYYY-MM-DD and reject anything that is not a real calendar day. */
function assertValidDate(date: string): [number, number, number] {
  const m = DATE_RE.exec(date);
  if (!m) {
    throw new RangeError(`Invalid date "${date}" — expected YYYY-MM-DD`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) {
    throw new RangeError(`Invalid date "${date}"`);
  }
  // Date.UTC normalizes overflow (2023-02-29 → Mar 01), so require an exact
  // round-trip to reject non-existent calendar days including non-leap Feb 29.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date "${date}"`);
  }
  return [year, month, day];
}

/**
 * Convert a Riyadh wall time to the exact UTC instant as ISO-8601
 * (`toISOString` format, e.g. `2026-05-15T11:00:00.000Z`).
 *
 * @param date calendar day in `YYYY-MM-DD`
 * @param time 24-hour wall time in `HH:mm`
 * @returns the UTC instant, independent of the process/browser timezone
 * @throws {RangeError} on malformed or non-existent dates/times
 */
export function riyadhWallTimeToUtcIso(date: string, time: string): string {
  const [year, month, day] = assertValidDate(date);
  const tm = TIME_RE.exec(time);
  if (!tm) {
    throw new RangeError(`Invalid time "${time}" — expected HH:mm (24-hour)`);
  }
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  if (hour > 23 || minute > 59) {
    throw new RangeError(`Invalid time "${time}"`);
  }

  // Treat the wall time as if it were UTC, then subtract the fixed +03:00
  // offset. All of Date.UTC / epoch arithmetic / toISOString are
  // timezone-agnostic, so the result is identical in every environment.
  const utcInstant = new Date(
    Date.UTC(year, month - 1, day, hour, minute) - RIYADH_UTC_OFFSET_MINUTES * 60_000,
  );
  return utcInstant.toISOString();
}
