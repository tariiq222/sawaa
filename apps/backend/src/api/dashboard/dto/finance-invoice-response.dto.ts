import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus, Prisma, type Invoice } from '@prisma/client';
import { ListMetaDto } from './people-response.dto';
import { PaymentRecordDto } from './finance-payment-record-response.dto';

/**
 * Response shapes of the invoice routes in `dashboard/finance.controller.ts`.
 *
 * These classes only document what the handlers return. They are never
 * instantiated and no serializer rewrites the payload, so they cannot change a
 * response. `finance-identity-response.dto.spec.ts` pins each one to the
 * handler's inferred return type.
 *
 * Money: every `Decimal` column is typed as `Prisma.Decimal` and documented as
 * a decimal string, because that is what Express serializes on the wire. No
 * amount in this file is a float.
 */

const UUID_EXAMPLE = '00000000-0000-4000-a000-000000000001';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** `GET /dashboard/finance/invoices` — one projected row. */
export class InvoiceListRowDto {
  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Sequential invoice number', example: 1024 })
  number!: number;

  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-000000000002' })
  clientId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Related booking UUID, or null', example: null })
  bookingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Resolved client display name, or null when the client row is gone', example: 'Sara Al-Harbi' })
  clientName!: string | null;

  @ApiProperty({ type: String, description: 'Subtotal in halalas, serialized as a decimal string', example: '20000' })
  subtotal!: Prisma.Decimal;

  @ApiProperty({ type: String, description: 'VAT amount in halalas, serialized as a decimal string', example: '0' })
  vatAmt!: Prisma.Decimal;

  @ApiProperty({ type: String, description: 'Invoice total in halalas, serialized as a decimal string', example: '20000' })
  total!: Prisma.Decimal;

  @ApiProperty({ type: String, description: 'Refunded amount in halalas, serialized as a decimal string', example: '0' })
  refundedAmount!: Prisma.Decimal;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ enum: InvoiceStatus, enumName: 'InvoiceStatus', description: 'Invoice status', example: 'PAID' })
  status!: InvoiceStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Issuance instant, or null before the first payment', example: ISO_EXAMPLE })
  issuedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Full-payment instant, or null', example: ISO_EXAMPLE })
  paidAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Instant the invoice was sent to the client, or null', example: null })
  sentToClientAt!: Date | null;

  @ApiProperty({ description: 'Whether a paid receipt key or legacy pdfUrl is present on the invoice', example: true })
  hasPdf!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;
}

/** `GET /dashboard/finance/invoices` — the canonical `{ items, meta }` envelope. */
export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceListRowDto], description: 'Invoices on the requested page, newest first' })
  items!: InvoiceListRowDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata' })
  meta!: ListMetaDto;
}

/**
 * One persisted `Invoice` row. Returned verbatim by `POST /invoices` and
 * `PATCH /invoices/:id/discount`.
 */
export class InvoiceRecordDto {
  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Sequential invoice number', example: 1024 })
  number!: number;

  @ApiProperty({ format: 'uuid', description: 'Branch UUID', example: '00000000-0000-4000-a000-000000000003' })
  branchId!: string;

  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-000000000002' })
  clientId!: string;

  @ApiProperty({ format: 'uuid', description: 'Employee UUID recorded on the invoice', example: '00000000-0000-4000-a000-000000000004' })
  employeeId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Booking UUID, or null for package-purchase invoices', example: null })
  bookingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Package-purchase UUID, or null for booking invoices', example: null })
  packagePurchaseId!: string | null;

  @ApiProperty({ type: String, description: 'Subtotal before discount and VAT, in halalas (decimal string)', example: '20000' })
  subtotal!: Prisma.Decimal;

  @ApiProperty({ type: String, description: 'Discount amount in halalas (decimal string)', example: '0' })
  discountAmt!: Prisma.Decimal;

  @ApiProperty({ type: String, nullable: true, description: 'Discount reason UUID, or null', example: null })
  discountReasonId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Staff user UUID that applied the manual discount, or null', example: null })
  discountAppliedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Manual-discount instant, or null', example: null })
  discountAppliedAt!: Date | null;

  @ApiProperty({ type: String, description: 'VAT rate as a fraction (0..1), serialized as a decimal string', example: '0' })
  vatRate!: Prisma.Decimal;

  @ApiProperty({ type: String, description: 'VAT amount in halalas (decimal string)', example: '0' })
  vatAmt!: Prisma.Decimal;

  @ApiProperty({ type: String, description: 'Invoice total in halalas (decimal string)', example: '20000' })
  total!: Prisma.Decimal;

  @ApiProperty({ type: String, description: 'Refunded amount in halalas (decimal string)', example: '0' })
  refundedAmount!: Prisma.Decimal;

  @ApiProperty({ type: String, description: 'Refunded VAT in halalas (decimal string)', example: '0' })
  refundedVatAmt!: Prisma.Decimal;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ enum: InvoiceStatus, enumName: 'InvoiceStatus', description: 'Invoice status', example: 'PAID' })
  status!: InvoiceStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Issuance instant, or null before the first payment', example: ISO_EXAMPLE })
  issuedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Payment due instant, or null', example: null })
  dueAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Full-payment instant, or null', example: ISO_EXAMPLE })
  paidAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Legacy pre-payment PDF object key, or null', example: null })
  pdfUrl!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Legacy PDF generation instant, or null', example: null })
  pdfGeneratedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen paid-receipt object key, or null', example: null })
  receiptPdfKey!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Paid-receipt issuance instant, or null', example: null })
  receiptIssuedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Payment UUID that triggered the receipt, or null', example: null })
  receiptPaymentId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Instant the invoice was sent to the client, or null', example: null })
  sentToClientAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Free-form invoice notes, or null', example: null })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** `GET /dashboard/finance/invoices/:id` — the invoice row plus its payments, newest first. */
export class InvoiceDetailResponseDto extends InvoiceRecordDto {
  @ApiProperty({ type: [PaymentRecordDto], description: 'Payments recorded against the invoice, newest first' })
  payments!: PaymentRecordDto[];
}

/** `GET /dashboard/finance/bookings/:bookingId/invoice` and the collect envelope. */
export class EnsuredInvoiceDto {
  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Subtotal in integer halalas', example: 20000 })
  subtotal!: number;

  @ApiProperty({ description: 'VAT rate as a fraction (0..1)', example: 0 })
  vatRate!: number;

  @ApiProperty({ description: 'Invoice total in integer halalas', example: 20000 })
  total!: number;

  @ApiProperty({ description: 'Unpaid balance in integer halalas', example: 20000 })
  outstanding!: number;

  @ApiProperty({ description: 'Invoice status at read time', example: 'DRAFT' })
  status!: string;
}

/** Short-lived presigned download URL for the invoice receipt or statement. */
export class InvoicePdfUrlDto {
  @ApiProperty({ description: 'Presigned URL valid for five minutes', example: 'https://minio.example.test/finance-invoices/receipts/inv-1.pdf?X-Amz-Signature=…' })
  url!: string;
}

// Compile-time guard: the row DTO must list exactly the columns of the Prisma row.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export const invoiceRecordDtoMatchesPrismaRow: Equal<keyof InvoiceRecordDto, keyof Invoice> = true;
