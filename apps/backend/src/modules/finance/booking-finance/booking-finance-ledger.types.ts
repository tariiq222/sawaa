import type { Prisma } from '@prisma/client';

export type BookingInvoiceIssueMode = 'DRAFT' | 'ISSUED';

export interface CreateBookingInvoiceInTxCommand {
  bookingId: string;
  branchId: string;
  clientId: string;
  /** Invoice.employeeId is NOT NULL in the schema. */
  employeeId: string;
  /** Net before tax, in halalas. */
  subtotal: number | Prisma.Decimal;
  /** Coupon discount, if any. Defaults to zero. */
  discountAmt?: number | Prisma.Decimal;
  /** ISO currency code. Defaults to the column default when omitted. */
  currency?: string;
  issueMode: BookingInvoiceIssueMode;
  /** Required when `issueMode === 'ISSUED'`. */
  issuedAt?: Date;
  /** Skips the OrganizationSettings read when supplied. */
  vatRate?: number | Prisma.Decimal;
}

export interface BookingInvoiceInTxResult {
  id: string;
  subtotal: Prisma.Decimal;
  discountAmt: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  vatAmt: Prisma.Decimal;
  total: Prisma.Decimal;
  status: 'DRAFT' | 'ISSUED';
  issuedAt: Date | null;
}

/** Thrown when the booking already has a payment that forbids deletion. */
export class BookingHasBlockingPaymentError extends Error {
  constructor(readonly bookingId: string) {
    super(`Booking ${bookingId} has a blocking payment`);
  }
}

/** Thrown when the booking already has a live payment that forbids deletion. */
export class BookingInvoiceAlreadyExistsError extends Error {
  constructor(
    readonly bookingId: string,
    readonly invoiceId: string,
  ) {
    super(`Booking ${bookingId} already has invoice ${invoiceId}`);
  }
}
