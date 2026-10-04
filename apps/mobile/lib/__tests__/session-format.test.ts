import { formatDayMonth, formatHalalasPrice, formatTimeOfDay } from '../session-format';

describe('session-format', () => {
  it('returns null for missing or invalid dates instead of throwing', () => {
    expect(formatDayMonth('', true)).toBeNull();
    expect(formatDayMonth(undefined, false)).toBeNull();
    expect(formatDayMonth('not-a-date', false)).toBeNull();
    expect(formatTimeOfDay(null, true)).toBeNull();
  });

  it('splits a date into day and month', () => {
    const result = formatDayMonth('2026-09-30T12:00:00Z', false);
    expect(result?.day).toBe('30');
    expect(result?.month).toBe('Sep');
  });

  it('formats integer halalas as riyals', () => {
    expect(formatHalalasPrice('15000', false, 'SAR')).toBe('150 SAR');
    expect(formatHalalasPrice(0, false, 'SAR')).toBe('0 SAR');
    expect(formatHalalasPrice('abc', false, 'SAR')).toBe('0 SAR');
  });
});
