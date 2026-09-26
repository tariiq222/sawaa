import { describe, it, expect } from 'vitest';
import { PublicFetchError } from '@/lib/public-fetch';
import { paymentFailureMessage } from './payment-error';

const FALLBACK = 'تعذر بدء عملية الدفع، حاول مرة أخرى.';

describe('paymentFailureMessage', () => {
  it('shows the Arabic reason the backend returned', () => {
    const err = new PublicFetchError(409, {
      message: 'هناك دفعة قيد التنفيذ لهذه الفاتورة، أكمل الدفع الحالي أو انتظر انتهاء الجلسة',
    });
    expect(paymentFailureMessage(err, FALLBACK)).toBe(
      'هناك دفعة قيد التنفيذ لهذه الفاتورة، أكمل الدفع الحالي أو انتظر انتهاء الجلسة',
    );
  });

  it('falls back to the localized line for an internal English conflict message', () => {
    const err = new PublicFetchError(409, {
      message: 'Invoice has another payment pending completion or verification',
    });
    expect(paymentFailureMessage(err, FALLBACK)).toBe(FALLBACK);
  });

  it('falls back when the failure carried no readable body', () => {
    expect(paymentFailureMessage(new Error('Network request failed'), FALLBACK)).toBe(FALLBACK);
    expect(paymentFailureMessage(new PublicFetchError(500, {}), FALLBACK)).toBe(FALLBACK);
  });
});
