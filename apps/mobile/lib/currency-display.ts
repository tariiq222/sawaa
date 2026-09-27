import { formatHalalas } from '@/lib/money';

/** Display only: booking prices arrive in integer halalas. */
export function formatCurrencyAmount(halalas: number, currency: string | undefined, isRTL: boolean): string {
  const amount = formatHalalas(halalas, { locale: isRTL ? 'ar-SA' : 'en-US' });
  const unit = currency === 'SAR' || !currency ? (isRTL ? 'ر.س' : 'SAR') : currency;
  return `${amount} ${unit}`;
}
