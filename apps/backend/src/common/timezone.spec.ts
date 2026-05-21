import {
  BUSINESS_TZ,
  parseLocalDateTime,
  combineYmdAndHmInBusinessTz,
  formatToBusinessHHmm,
  formatToBusinessYmd,
  nowInBusinessTz,
} from './timezone';

describe('timezone helpers (Asia/Riyadh)', () => {
  it('BUSINESS_TZ is Asia/Riyadh', () => {
    expect(BUSINESS_TZ).toBe('Asia/Riyadh');
  });

  describe('parseLocalDateTime', () => {
    it('converts 14:30 Riyadh → 11:30 UTC (−3 h offset, no DST)', () => {
      const utc = parseLocalDateTime('2026-06-15', '14:30');
      expect(utc.toISOString()).toBe('2026-06-15T11:30:00.000Z');
    });

    it('converts midnight Riyadh → 21:00 UTC previous day', () => {
      const utc = parseLocalDateTime('2026-06-15', '00:00');
      expect(utc.toISOString()).toBe('2026-06-14T21:00:00.000Z');
    });

    it('converts end-of-day 23:59 Riyadh correctly', () => {
      const utc = parseLocalDateTime('2026-06-15', '23:59');
      expect(utc.toISOString()).toBe('2026-06-15T20:59:00.000Z');
    });

    it('result is the same regardless of process.env.TZ', () => {
      const originalTz = process.env.TZ;
      try {
        process.env.TZ = 'UTC';
        const utcResult = parseLocalDateTime('2026-06-15', '14:30');

        process.env.TZ = 'America/New_York';
        const nyResult = parseLocalDateTime('2026-06-15', '14:30');

        expect(utcResult.toISOString()).toBe(nyResult.toISOString());
        expect(utcResult.toISOString()).toBe('2026-06-15T11:30:00.000Z');
      } finally {
        if (originalTz === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = originalTz;
        }
      }
    });
  });

  describe('combineYmdAndHmInBusinessTz', () => {
    it('is an alias for parseLocalDateTime and returns the same UTC instant', () => {
      const a = parseLocalDateTime('2026-06-15', '09:00');
      const b = combineYmdAndHmInBusinessTz('2026-06-15', '09:00');
      expect(a.toISOString()).toBe(b.toISOString());
    });
  });

  describe('formatToBusinessHHmm', () => {
    it('formats 11:30 UTC → 14:30 Riyadh', () => {
      const d = new Date('2026-06-15T11:30:00.000Z');
      expect(formatToBusinessHHmm(d)).toBe('14:30');
    });

    it('formats midnight UTC → 03:00 Riyadh', () => {
      const d = new Date('2026-06-15T00:00:00.000Z');
      expect(formatToBusinessHHmm(d)).toBe('03:00');
    });

    it('pads single-digit hours correctly', () => {
      const d = new Date('2026-06-15T05:05:00.000Z');
      expect(formatToBusinessHHmm(d)).toBe('08:05');
    });

    it('round-trips with parseLocalDateTime', () => {
      const original = '10:15';
      const utc = parseLocalDateTime('2026-06-15', original);
      const roundTripped = formatToBusinessHHmm(utc);
      expect(roundTripped).toBe(original);
    });

    it('is stable across process.env.TZ values', () => {
      const d = new Date('2026-06-15T11:30:00.000Z');
      const originalTz = process.env.TZ;
      try {
        process.env.TZ = 'UTC';
        const utcResult = formatToBusinessHHmm(d);

        process.env.TZ = 'America/New_York';
        const nyResult = formatToBusinessHHmm(d);

        expect(utcResult).toBe(nyResult);
        expect(utcResult).toBe('14:30');
      } finally {
        if (originalTz === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = originalTz;
        }
      }
    });
  });

  describe('formatToBusinessYmd', () => {
    it('formats 11:30 UTC on 2026-06-15 → same calendar day in Riyadh', () => {
      const d = new Date('2026-06-15T11:30:00.000Z');
      expect(formatToBusinessYmd(d)).toBe('2026-06-15');
    });

    it('crosses calendar day: 22:30 UTC → next day in Riyadh (+3 h)', () => {
      const d = new Date('2026-06-14T22:30:00.000Z');
      // 22:30 UTC + 3h = 01:30 Riyadh next day
      expect(formatToBusinessYmd(d)).toBe('2026-06-15');
    });

    it('round-trips with parseLocalDateTime for the date part', () => {
      const utc = parseLocalDateTime('2026-06-15', '14:30');
      expect(formatToBusinessYmd(utc)).toBe('2026-06-15');
    });
  });

  describe('nowInBusinessTz', () => {
    it('returns a Date within a second of Date.now()', () => {
      const before = Date.now();
      const now = nowInBusinessTz();
      const after = Date.now();
      expect(now.getTime()).toBeGreaterThanOrEqual(before);
      expect(now.getTime()).toBeLessThanOrEqual(after + 10);
    });
  });
});
