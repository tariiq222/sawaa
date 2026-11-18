import { PaymentMethod, PaymentStatus, Prisma, type Payment } from '@prisma/client';

const RECEIVED_AT = '2030-01-15T10:00:00.000Z';

/** Valid `Payment` row with deterministic defaults, amounts in integer halalas. */
export function buildPayment(overrides: Partial<Payment> = {}): Payment {
  const receivedAt = new Date(RECEIVED_AT);
  return {
    id: 'payment-1',
    number: 1,
    invoiceId: 'invoice-1',
    amount: new Prisma.Decimal(15_000),
    refundedAmount: new Prisma.Decimal(0),
    currency: 'SAR',
    method: PaymentMethod.CASH,
    status: PaymentStatus.COMPLETED,
    gatewayRef: null,
    idempotencyKey: null,
    nativeConfigFingerprint: null,
    receiptUrl: null,
    failureReason: null,
    refundProviderLeaseOwner: null,
    refundProviderLeaseExpiresAt: null,
    effectiveReceivedAt: receivedAt,
    receiptRecordedBy: null,
    receiptEvidenceRef: null,
    receiptEntryReason: null,
    processedAt: receivedAt,
    createdAt: receivedAt,
    updatedAt: receivedAt,
    ...overrides,
  };
}
