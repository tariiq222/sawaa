import { InvoiceStatus, Prisma, type Invoice } from '@prisma/client';

const ISSUED_AT = '2030-01-15T08:00:00.000Z';
const CREATED_AT = '2030-01-15T07:00:00.000Z';

/** Valid `Invoice` row with deterministic defaults, amounts in integer halalas. */
export function buildInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const createdAt = new Date(CREATED_AT);
  return {
    id: 'invoice-1',
    number: 1,
    branchId: 'branch-1',
    clientId: 'client-1',
    employeeId: 'employee-1',
    bookingId: 'booking-1',
    packagePurchaseId: null,
    subtotal: new Prisma.Decimal(15_000),
    discountAmt: new Prisma.Decimal(0),
    discountReasonId: null,
    discountAppliedBy: null,
    discountAppliedAt: null,
    vatRate: new Prisma.Decimal(0),
    vatAmt: new Prisma.Decimal(0),
    total: new Prisma.Decimal(15_000),
    refundedAmount: new Prisma.Decimal(0),
    refundedVatAmt: new Prisma.Decimal(0),
    currency: 'SAR',
    status: InvoiceStatus.ISSUED,
    issuedAt: new Date(ISSUED_AT),
    dueAt: null,
    paidAt: null,
    pdfUrl: null,
    pdfGeneratedAt: null,
    receiptPdfKey: null,
    receiptIssuedAt: null,
    receiptPaymentId: null,
    sentToClientAt: null,
    notes: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}
