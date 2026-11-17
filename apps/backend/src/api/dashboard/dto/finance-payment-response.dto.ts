import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { ListMetaDto } from './people-response.dto';
import { EnsuredInvoiceDto } from './finance-invoice-response.dto';
import { PaymentRecordDto } from './finance-payment-record-response.dto';
import type { DeferredPaymentEvent } from '../../../modules/finance/process-payment/process-payment.handler';

/**
 * Response shapes of the payment routes in `dashboard/finance.controller.ts`.
 *
 * Documentation only: the classes are never instantiated and nothing rewrites
 * the payload. `finance-identity-response.dto.spec.ts` pins each one to the
 * handler's inferred return type, so a shape change becomes a compile error.
 *
 * Money: `Prisma.Decimal` money columns are decimal strings on the wire; the
 * stats payload aggregates with `toNumber()` and is therefore integer halalas.
 */

const UUID_EXAMPLE = '00000000-0000-4000-a000-0000000000a1';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** Client identity attached to a payment's invoice. */
export class PaymentInvoiceClientDto {
  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-000000000002' })
  id!: string;

  @ApiProperty({ description: 'Client display name', example: 'Sara Al-Harbi' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, description: 'First name, or null', example: 'Sara' })
  firstName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Last name, or null', example: 'Al-Harbi' })
  lastName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Phone number, or null', example: '+966501234567' })
  phone!: string | null;
}

/** Invoice projection attached to a payment list row (no invoice number). */
export class PaymentListInvoiceSummaryDto {
  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-000000000002' })
  clientId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Booking UUID, or null for package-purchase invoices', example: null })
  bookingId!: string | null;

  @ApiProperty({ type: String, description: 'Invoice total in halalas (decimal string)', example: '20000' })
  total!: Prisma.Decimal;

  @ApiProperty({ type: PaymentInvoiceClientDto, nullable: true, description: 'Resolved client, or null when the client row is gone' })
  client!: PaymentInvoiceClientDto | null;
}

/** Invoice projection attached to a payment detail read (carries the invoice number). */
export class PaymentDetailInvoiceSummaryDto extends PaymentListInvoiceSummaryDto {
  @ApiProperty({ description: 'Invoice number', example: 1024 })
  number!: number;
}

/** `GET /dashboard/finance/payments` — one payment plus its collection date and invoice projection. */
export class PaymentListRowDto extends PaymentRecordDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'Collection date (effective received instant, else created instant) as an ISO timestamp', example: ISO_EXAMPLE })
  collectionDate!: string;

  @ApiProperty({ type: () => PaymentListInvoiceSummaryDto, nullable: true, description: 'Invoice projection, or null' })
  invoice!: PaymentListInvoiceSummaryDto | null;
}

/** `GET /dashboard/finance/payments` — the canonical `{ items, meta }` envelope. */
export class PaymentListResponseDto {
  @ApiProperty({ type: [PaymentListRowDto], description: 'Payments on the requested page, newest collection first' })
  items!: PaymentListRowDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata' })
  meta!: ListMetaDto;
}

/** One refund request attached to a payment detail read. */
export class PaymentRefundRequestRowDto {
  @ApiProperty({ format: 'uuid', description: 'Refund request UUID', example: '00000000-0000-4000-a000-0000000000a3' })
  id!: string;

  @ApiProperty({ type: String, description: 'Refund amount in halalas (decimal string)', example: '5000' })
  amount!: Prisma.Decimal;

  @ApiProperty({ enum: RefundStatus, enumName: 'RefundStatus', description: 'Refund request status', example: 'PENDING_REVIEW' })
  status!: RefundStatus;

  @ApiProperty({ type: String, nullable: true, description: 'Refund reason, or null', example: 'Service not delivered' })
  reason!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;
}

/**
 * `GET /dashboard/finance/payments/:id` — the payment row with a presigned
 * `receiptUrl`, the invoice projection (plus client), and its refund requests.
 */
export class PaymentDetailResponseDto extends PaymentRecordDto {
  @ApiProperty({ type: () => PaymentDetailInvoiceSummaryDto, nullable: true, description: 'Invoice projection with the resolved client, or null' })
  invoice!: PaymentDetailInvoiceSummaryDto | null;

  @ApiProperty({ type: [PaymentRefundRequestRowDto], description: 'Refund requests for this payment, newest first' })
  refundRequests!: PaymentRefundRequestRowDto[];
}

/** Historical Booknetic collections, reported separately from operational finance. */
export class PaymentHistoricalStatsDto {
  @ApiProperty({ description: 'Collected appointment count', example: 3427 })
  collectedCount!: number;

  @ApiProperty({ description: 'Collected amount in integer halalas', example: 103353250 })
  collectedAmount!: number;

  @ApiProperty({ description: 'Appointments awaiting review', example: 109 })
  reviewCount!: number;

  @ApiProperty({ description: 'Amount awaiting review in integer halalas', example: 1575000 })
  reviewAmount!: number;
}

/** `GET /dashboard/finance/payments/stats` — operational totals plus the legacy summary. */
export class PaymentStatsResponseDto {
  @ApiProperty({ description: 'Total payment rows', example: 29 })
  total!: number;

  @ApiProperty({ description: 'Total amount in integer halalas', example: 125000 })
  totalAmount!: number;

  @ApiProperty({ description: 'COMPLETED row count', example: 20 })
  completed!: number;

  @ApiProperty({ description: 'COMPLETED amount in integer halalas', example: 100000 })
  completedAmount!: number;

  @ApiProperty({ description: 'PENDING row count', example: 2 })
  pending!: number;

  @ApiProperty({ description: 'PENDING amount in integer halalas', example: 10000 })
  pendingAmount!: number;

  @ApiProperty({ description: 'PENDING_VERIFICATION row count', example: 1 })
  pendingVerification!: number;

  @ApiProperty({ description: 'PENDING_VERIFICATION amount in integer halalas', example: 5000 })
  pendingVerificationAmount!: number;

  @ApiProperty({ description: 'REFUNDED row count', example: 3 })
  refunded!: number;

  @ApiProperty({ description: 'REFUNDED amount in integer halalas', example: 10000 })
  refundedAmount!: number;

  @ApiProperty({ description: 'FAILED row count', example: 3 })
  failed!: number;

  @ApiProperty({ type: PaymentHistoricalStatsDto, description: 'Read-only legacy Booknetic summary' })
  historical!: PaymentHistoricalStatsDto;
}

/** Deferred domain event staged by `ProcessPaymentHandler` (returned by `POST /payments`). */
export class PaymentDeferredEventDto {
  @ApiProperty({ description: 'Domain event name', example: 'finance.payment.completed' })
  eventName!: string;

  @ApiProperty({
    description: 'Event envelope ({ eventId, correlationId, source, version, occurredAt, payload })',
    example: {
      eventId: '00000000-0000-4000-a000-0000000000a4',
      correlationId: '00000000-0000-4000-a000-0000000000a5',
      source: 'finance',
      version: 1,
      occurredAt: ISO_EXAMPLE,
      payload: { paymentId: UUID_EXAMPLE },
    },
    type: 'object',
    additionalProperties: true,
  })
  envelope!: DeferredPaymentEvent['envelope'];
}

/** `POST /dashboard/finance/payments` — the created (or replayed) payment row. */
export class PaymentProcessResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Payment UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-0000000000a2' })
  invoiceId!: string;

  @ApiProperty({
    description: 'Payment amount in halalas: a number, or a Prisma Decimal (decimal string on the wire)',
    oneOf: [{ type: 'number' }, { type: 'string' }],
    example: 20000,
  })
  amount!: Prisma.Decimal | number;

  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod', description: 'Payment method used', example: 'CASH' })
  method!: PaymentMethod;

  @ApiProperty({ description: 'Payment status (Prisma PaymentStatus or its string value)', example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ type: [PaymentDeferredEventDto], description: 'Domain events staged in the write transaction', required: false })
  deferredEvents?: PaymentDeferredEventDto[];
}

/** One credit row in the `POST /bookings/:bookingId/collect` envelope. */
export class PaymentCollectionPaymentDto {
  @ApiProperty({ format: 'uuid', description: 'Payment UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Collected amount in integer halalas', example: 15000 })
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod', description: 'Payment method used', example: 'CASH' })
  method!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus', example: 'COMPLETED' })
  status!: PaymentStatus;
}

/** `POST /dashboard/finance/bookings/:bookingId/collect` — invoice + optional payment. */
export class PaymentCollectionResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Booking UUID', example: '00000000-0000-4000-a000-0000000000a6' })
  bookingId!: string;

  @ApiProperty({ type: EnsuredInvoiceDto, description: 'The ensured invoice (halalas, integer fields)' })
  invoice!: EnsuredInvoiceDto;

  @ApiProperty({ type: PaymentCollectionPaymentDto, nullable: true, description: 'Recorded payment, or null when a 100% discount covered the invoice' })
  payment!: PaymentCollectionPaymentDto | null;
}
