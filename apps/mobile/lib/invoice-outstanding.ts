import type { ClientInvoice } from '@/services/client/payments';

/**
 * Payments that already claim part of an invoice. Mirrors the backend bank
 * transfer upload (`bank-transfer-upload.handler.ts`), which only accepts the
 * invoice total minus these payments (or the configured deposit).
 */
const COMMITTED_PAYMENT_STATUSES = new Set(['COMPLETED', 'PENDING', 'PENDING_VERIFICATION']);

function toHalalas(value: unknown): number | null {
  const number = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? Math.round(number) : null;
}

/**
 * Amount, in integer halalas, still owed on an invoice. Returns null when the
 * invoice does not carry a usable total or a payment amount, so callers never
 * guess a figure that the server would reject. Zero or negative means nothing
 * more can be paid.
 */
export function getOutstandingHalalas(invoice: ClientInvoice): number | null {
  const total = toHalalas(invoice.total);
  if (total === null) return null;
  let committed = 0;
  for (const payment of invoice.payments ?? []) {
    if (!COMMITTED_PAYMENT_STATUSES.has(String(payment.status).toUpperCase())) continue;
    const amount = toHalalas(payment.amount);
    if (amount === null) return null;
    committed += amount;
  }
  return total - committed;
}
