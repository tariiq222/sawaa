export type HistoricalPaymentStatus =
  | 'paid'
  | 'not_paid'
  | 'pending'
  | 'canceled'
  | 'unknown';

export interface HistoricalPaymentMetadata {
  paymentStatus?: unknown;
  paymentMethod?: unknown;
  paidAmount?: unknown;
}

export interface HistoricalPaymentProjection {
  status: HistoricalPaymentStatus;
  amount: number;
  method: string | null;
  requiresReview: boolean;
}

const HISTORICAL_PAYMENT_STATUSES = new Set<HistoricalPaymentStatus>([
  'paid',
  'not_paid',
  'pending',
  'canceled',
]);

export function mapHistoricalPayment(
  metadata: HistoricalPaymentMetadata,
  bookingStatus: string,
): HistoricalPaymentProjection {
  const rawStatus = typeof metadata.paymentStatus === 'string'
    ? metadata.paymentStatus.trim().toLowerCase()
    : '';
  const status = HISTORICAL_PAYMENT_STATUSES.has(rawStatus as HistoricalPaymentStatus)
    ? rawStatus as HistoricalPaymentStatus
    : 'unknown';
  const amountSar = typeof metadata.paidAmount === 'string' || typeof metadata.paidAmount === 'number'
    ? Number(metadata.paidAmount)
    : 0;
  const method = typeof metadata.paymentMethod === 'string' && metadata.paymentMethod.trim()
    ? metadata.paymentMethod.trim()
    : null;

  return {
    status,
    amount: Number.isFinite(amountSar) ? Math.round(amountSar * 100) : 0,
    method,
    requiresReview: status === 'paid' && bookingStatus.toUpperCase() !== 'CONFIRMED',
  };
}
