import { ApiProperty } from '@nestjs/swagger';
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  type Invoice,
  type Payment,
} from '@prisma/client';
import { BookingRowDto } from './booking-row-response.dto';

/**
 * Response of POST /dashboard/bookings/late-entry (`lateSessionResult`). The
 * invoice and payment are the Prisma rows spread with a few numeric overrides,
 * so unconverted `Decimal` columns are decimal strings on the wire.
 */

const ISO_DATE_TIME = { type: String, format: 'date-time' } as const;
const DECIMAL_STRING = { type: String } as const;

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

export class LateEntryInvoiceDto {
  @ApiProperty({ description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000008' })
  id!: string;

  @ApiProperty({ description: 'Sequential invoice number', example: 1001 })
  number!: number;

  @ApiProperty({ description: 'Branch UUID', example: '00000000-0000-0000-0000-00000000000c' })
  branchId!: string;

  @ApiProperty({ description: 'Client UUID', example: '00000000-0000-0000-0000-000000000001' })
  clientId!: string;

  @ApiProperty({ description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000003' })
  employeeId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000002' })
  bookingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Package purchase UUID (package invoices only)', example: null })
  packagePurchaseId!: string | null;

  @ApiProperty({ description: 'Net amount before VAT and discount, in halalas (converted to a number)', example: 20000 })
  subtotal!: number;

  @ApiProperty({ description: 'Discount amount in halalas (converted to a number)', example: 0 })
  discountAmt!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Discount reason UUID', example: null })
  discountReasonId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'User who applied the discount', example: null })
  discountAppliedBy!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the discount was applied', example: null })
  discountAppliedAt!: Date | null;

  @ApiProperty({ description: 'VAT rate as a fraction of 1 (converted to a number)', example: 0 })
  vatRate!: number;

  @ApiProperty({ description: 'VAT amount in halalas (converted to a number)', example: 0 })
  vatAmt!: number;

  @ApiProperty({ description: 'Total after discount in halalas (converted to a number)', example: 20000 })
  total!: number;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Refunded amount in halalas, decimal string (not converted)', example: '0' })
  refundedAmount!: Prisma.Decimal;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Refunded VAT in halalas, decimal string (not converted)', example: '0' })
  refundedVatAmt!: Prisma.Decimal;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Invoice status', enum: Object.values(InvoiceStatus), example: 'ISSUED' })
  status!: InvoiceStatus;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Issue instant', example: null })
  issuedAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Due instant', example: null })
  dueAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Paid instant', example: null })
  paidAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Stored PDF URL', example: null })
  pdfUrl!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the PDF was generated', example: null })
  pdfGeneratedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen paid-receipt object key', example: null })
  receiptPdfKey!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the paid receipt was issued', example: null })
  receiptIssuedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Payment that triggered the receipt', example: null })
  receiptPaymentId!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the invoice was sent to the client', example: null })
  sentToClientAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Invoice notes', example: null })
  notes!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-06-02T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-06-02T09:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Total minus paid/refunded payments, in halalas', example: 0 })
  outstanding!: number;
}

export class LateEntryPaymentDto {
  @ApiProperty({ description: 'Payment UUID', example: '00000000-0000-0000-0000-000000000006' })
  id!: string;

  @ApiProperty({ description: 'Sequential payment number', example: 2001 })
  number!: number;

  @ApiProperty({ description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000008' })
  invoiceId!: string;

  @ApiProperty({ description: 'Amount in halalas (converted to a number)', example: 20000 })
  amount!: number;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Refunded amount in halalas, decimal string (not converted)', example: '0' })
  refundedAmount!: Prisma.Decimal;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Payment method', enum: Object.values(PaymentMethod), example: 'CASH' })
  method!: PaymentMethod;

  @ApiProperty({ description: 'Payment status', enum: Object.values(PaymentStatus), example: 'COMPLETED' })
  status!: PaymentStatus;

  @ApiProperty({ type: String, nullable: true, description: 'Gateway payment reference', example: null })
  gatewayRef!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Idempotency key', example: null })
  idempotencyKey!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Fingerprint of the native checkout configuration', example: null })
  nativeConfigFingerprint!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Stored receipt file path', example: null })
  receiptUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Failure reason', example: null })
  failureReason!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Worker holding the refund provider lease', example: null })
  refundProviderLeaseOwner!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Refund provider lease expiry', example: null })
  refundProviderLeaseExpiresAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the money was actually received', example: '2026-06-01T09:00:00.000Z' })
  effectiveReceivedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'User who recorded the receipt', example: '00000000-0000-0000-0000-000000000007' })
  receiptRecordedBy!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Evidence reference of the receipt', example: 'RCPT-1001' })
  receiptEvidenceRef!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Reason the receipt was entered after the fact', example: null })
  receiptEntryReason!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Processing instant', example: null })
  processedAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-06-02T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-06-02T09:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'effectiveReceivedAt, falling back to createdAt', example: '2026-06-01T09:00:00.000Z' })
  collectionDate!: string;
}

export class LateEntryResultDto {
  @ApiProperty({ type: BookingRowDto, description: 'The recorded booking in the dashboard read projection' })
  booking!: BookingRowDto;

  @ApiProperty({ type: LateEntryInvoiceDto, nullable: true, description: 'Invoice created for the session; null when none' })
  invoice!: LateEntryInvoiceDto | null;

  @ApiProperty({ type: LateEntryPaymentDto, nullable: true, description: 'Latest payment on the invoice; null when none' })
  payment!: LateEntryPaymentDto | null;

  @ApiProperty({ description: 'Outstanding balance in halalas', example: 0 })
  outstanding!: number;

  @ApiProperty({ type: Boolean, enum: [true], description: 'Always true', example: true })
  isLateEntry!: true;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'When the late entry was recorded', example: '2026-06-02T09:00:00.000Z' })
  lateEntryRecordedAt!: string;

  @ApiProperty({ description: 'User id who recorded the late entry', example: '00000000-0000-0000-0000-000000000007' })
  lateEntryRecordedBy!: string;
}

export const lateEntryInvoiceDtoMatchesPrismaRow: Equal<keyof LateEntryInvoiceDto, keyof Invoice | 'outstanding'> = true;
export const lateEntryPaymentDtoMatchesPrismaRow: Equal<keyof LateEntryPaymentDto, keyof Payment | 'collectionDate'> = true;
