import { endOfDayInTz, startOfDayInTz } from './date-tz.helper';

describe('date-tz.helper', () => {
  describe('startOfDayInTz', () => {
    it('returns undefined for missing input', () => {
      expect(startOfDayInTz()).toBeUndefined();
      expect(startOfDayInTz(undefined)).toBeUndefined();
    });

    it('anchors yyyy-MM-dd at 00:00 Asia/Riyadh (+03:00)', () => {
      const d = startOfDayInTz('2026-05-21');
      expect(d).toBeInstanceOf(Date);
      expect(d!.toISOString()).toBe('2026-05-20T21:00:00.000Z');
    });

    it('truncates ISO datetimes to their date part', () => {
      const d = startOfDayInTz('2026-05-21T18:45:00Z');
      expect(d!.toISOString()).toBe('2026-05-20T21:00:00.000Z');
    });
  });

  describe('endOfDayInTz', () => {
    it('returns undefined for missing input', () => {
      expect(endOfDayInTz()).toBeUndefined();
    });

    it('anchors yyyy-MM-dd at 23:59:59.999 Asia/Riyadh (+03:00)', () => {
      const d = endOfDayInTz('2026-05-21');
      // 23:59:59.999 +03:00 == 20:59:59.999 UTC same day.
      expect(d!.toISOString()).toBe('2026-05-21T20:59:59.999Z');
    });

    it('covers the full calendar day so `lte` includes records after 00:00 UTC', () => {
      const end = endOfDayInTz('2026-05-21')!;
      const lateAfternoonRiyadh = new Date('2026-05-21T17:30:00+03:00');
      expect(lateAfternoonRiyadh.getTime()).toBeLessThanOrEqual(end.getTime());
    });
  });
});


describe('server timezone independent calendar bounds', () => {
  afterEach(() => jest.useRealTimers());
  it('uses Riyadh today and month at a UTC date boundary', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-09T22:30:00Z'));
    const { todayRangeInTz, startOfMonthInTz, dateRangeInTz } = jest.requireActual('./date-tz.helper');
    expect(todayRangeInTz()).toEqual({start:new Date('2026-10-09T21:00:00Z'),end:new Date('2026-10-10T21:00:00Z')});
    expect(startOfMonthInTz()).toEqual({start:new Date('2026-09-30T21:00:00Z'),end:new Date('2026-10-31T21:00:00Z')});
    expect(dateRangeInTz('2026-10-10','2026-10-10')).toEqual({start:new Date('2026-10-09T21:00:00Z'),end:new Date('2026-10-10T21:00:00Z')});
  });
  it('preserves the optional timezone parameter across DST',()=>{
    const {dateRangeInTz} = jest.requireActual('./date-tz.helper');
    expect(dateRangeInTz('2026-03-08','2026-03-08','America/New_York')).toEqual({start:new Date('2026-03-08T05:00:00Z'),end:new Date('2026-03-09T04:00:00Z')});
  });
});
