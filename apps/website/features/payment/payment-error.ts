import { publicErrorMessage } from '@/lib/public-fetch';

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

/**
 * The reason to show a client when starting a payment failed.
 *
 * `payments/init` mixes client-safe Arabic copy with internal English conflict
 * messages ("Invoice has another payment pending completion or verification").
 * The Arabic ones explain the real state ("هناك دفعة قيد التنفيذ لهذه الفاتورة")
 * and are worth showing; leaking an internal English sentence to an
 * Arabic-speaking client is not, so anything else falls back to the localized
 * generic line.
 */
export function paymentFailureMessage(error: unknown, fallback: string): string {
  const backendMessage = publicErrorMessage(error);
  return backendMessage && ARABIC_SCRIPT.test(backendMessage) ? backendMessage : fallback;
}
