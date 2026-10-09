import { formatConfirmDate, formatConfirmTime } from '../confirm-format';

describe('confirm formatting', () => {
  it('uses Arabic-Indic digits without grouping in RTL', () => {
    expect(formatConfirmDate(new Date('2026-10-02T00:00:00+03:00'), true)).toBe('٢ أكتوبر ٢٠٢٦');
    expect(formatConfirmTime(new Date('2026-10-02T17:00:00+03:00'), true)).toBe('٥:٠٠ م');
  });

  it('keeps English output unchanged', () => {
    expect(formatConfirmDate(new Date('2026-10-02T00:00:00+03:00'), false)).toBe('Oct 2, 2026');
    expect(formatConfirmTime(new Date('2026-10-02T17:00:00+03:00'), false)).toBe('5:00 PM');
  });
});

it('renders missing timing as a placeholder instead of malformed date text', () => {
  expect(formatConfirmDate(new Date('invalid'), true)).toBe('—');
  expect(formatConfirmTime(new Date('invalid'), false)).toBe('—');
});


it('keeps confirmation date on the Riyadh day across UTC midnight boundaries', () => {
  const instant = new Date('2026-10-09T22:30:00Z');
  expect(formatConfirmDate(instant, false)).toBe('Oct 10, 2026');
  expect(formatConfirmDate(instant, true)).toBe('١٠ أكتوبر ٢٠٢٦');
  expect(formatConfirmTime(instant, false)).toBe('1:30 AM');
});
