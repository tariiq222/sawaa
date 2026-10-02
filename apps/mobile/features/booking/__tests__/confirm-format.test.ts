import { formatConfirmDate, formatConfirmTime } from '../confirm-format';

describe('confirm formatting', () => {
  it('uses Arabic-Indic digits without grouping in RTL', () => {
    expect(formatConfirmDate(new Date(2026, 9, 2), true)).toBe('٢ أكتوبر ٢٠٢٦');
    expect(formatConfirmTime(new Date(2026, 9, 2, 17, 0), true)).toBe('٥:٠٠ م');
  });

  it('keeps English output unchanged', () => {
    expect(formatConfirmDate(new Date(2026, 9, 2), false)).toBe('Oct 2, 2026');
    expect(formatConfirmTime(new Date(2026, 9, 2, 17, 0), false)).toBe('5:00 PM');
  });
});
