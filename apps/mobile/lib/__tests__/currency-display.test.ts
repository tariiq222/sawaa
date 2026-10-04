import { formatCurrencyAmount } from '../currency-display';

describe('formatCurrencyAmount', () => {
  it('converts halalas and displays a readable Saudi currency label', () => {
    expect(formatCurrencyAmount(45000, 'SAR', false)).toBe('450.00 SAR');
    expect(formatCurrencyAmount(45000, 'SAR', true)).toContain('ر.س');
  });

  it('keeps a non-SAR currency code', () => {
    expect(formatCurrencyAmount(1250, 'USD', false)).toBe('12.50 USD');
  });
});
