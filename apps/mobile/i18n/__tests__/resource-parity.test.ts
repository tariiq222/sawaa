import ar from '../ar.json';
import en from '../en.json';
import { translatedTestMessage } from '@/test-utils/translation';

function keys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => typeof child === 'object' && child !== null ? keys(child as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]);
}

it('offers the same translation keys to both supported languages', () => {
  expect(keys(ar).sort()).toEqual(keys(en).sort());
});
it.each([['ar', 'ادفع ١٥٠ ر.س', 'تم اختيار الإيصال'], ['en', 'Pay 150 SAR', 'Receipt selected']])('interpolates checkout and distinguishes a selected receipt from confirmed payment in %s', (locale, pay, selected) => {
  expect(translatedTestMessage('booking.payAmount', locale, { amount: locale === 'ar' ? '١٥٠ ر.س' : '150 SAR' })).toBe(pay);
  expect(translatedTestMessage('payment.receiptSelected', locale)).toBe(selected);
  expect(translatedTestMessage('payment.receiptSelected', locale)).not.toBe(translatedTestMessage('booking.paymentReceived', locale));
});
