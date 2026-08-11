import { describe, it, expect, afterAll } from 'vitest';
import { riyadhWallTimeToUtcIso } from './booking-timezone';

/**
 * Conversion contract: the inputs are a calendar date (YYYY-MM-DD) and a
 * 24-hour wall time (HH:mm) as the user picks them in the Riyadh timezone
 * (UTC+03:00, no DST). The output is the exact UTC instant as ISO-8601 with
 * millisecond precision (`toISOString` format), computed with explicit
 * arithmetic — never via the browser/process local timezone.
 */
describe('riyadhWallTimeToUtcIso', () => {
  it('converts an afternoon wall time to UTC (14:00 Riyadh = 11:00 UTC)', () => {
    expect(riyadhWallTimeToUtcIso('2026-05-15', '14:00')).toBe('2026-05-15T11:00:00.000Z');
  });

  it('rolls midnight back into the previous UTC day', () => {
    expect(riyadhWallTimeToUtcIso('2026-05-15', '00:00')).toBe('2026-05-14T21:00:00.000Z');
  });

  it('keeps 23:59 on the same UTC day', () => {
    expect(riyadhWallTimeToUtcIso('2026-05-15', '23:59')).toBe('2026-05-15T20:59:00.000Z');
  });

  it('rolls the year boundary back correctly', () => {
    expect(riyadhWallTimeToUtcIso('2026-01-01', '00:00')).toBe('2025-12-31T21:00:00.000Z');
  });

  it('accepts a valid leap day and converts it', () => {
    expect(riyadhWallTimeToUtcIso('2024-02-29', '12:00')).toBe('2024-02-29T09:00:00.000Z');
  });

  it('converts the last day of the year', () => {
    expect(riyadhWallTimeToUtcIso('2026-12-31', '23:59')).toBe('2026-12-31T20:59:00.000Z');
  });

  describe('is independent of the process/browser timezone', () => {
    const originalTz = process.env.TZ;

    afterAll(() => {
      if (originalTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTz;
      }
    });

    it.each(['America/Los_Angeles', 'Asia/Riyadh', 'Pacific/Kiritimati'])(
      'produces the same UTC instant under TZ=%s',
      (tz) => {
        process.env.TZ = tz;
        expect(riyadhWallTimeToUtcIso('2026-05-15', '14:00')).toBe('2026-05-15T11:00:00.000Z');
        expect(riyadhWallTimeToUtcIso('2026-05-15', '00:00')).toBe('2026-05-14T21:00:00.000Z');
      },
    );
  });

  describe('rejects invalid input with a RangeError (safe, catchable)', () => {
    it.each([
      ['', '14:00'],
      ['2026-5-15', '14:00'],
      ['15/05/2026', '14:00'],
      ['2026-05-15T', '14:00'],
      ['2026-13-01', '14:00'],
      ['2026-00-10', '14:00'],
      ['2026-05-32', '14:00'],
      ['2026-02-30', '14:00'],
      ['2023-02-29', '14:00'], // 2023 is not a leap year
      ['2026-05-15', ''],
      ['2026-05-15', '9:00'],
      ['2026-05-15', '14:0'],
      ['2026-05-15', '24:00'],
      ['2026-05-15', '25:00'],
      ['2026-05-15', '12:60'],
      ['2026-05-15', '12:00:00'],
    ])('throws for date=%j time=%j', (date, time) => {
      expect(() => riyadhWallTimeToUtcIso(date, time)).toThrow(RangeError);
    });
  });
});
