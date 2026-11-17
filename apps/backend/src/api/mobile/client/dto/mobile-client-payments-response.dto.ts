import { ApiProperty } from '@nestjs/swagger';
import type { Invoice, Payment } from '@prisma/client';
import { ListMetaDto } from '../../../dashboard/dto/people-response.dto';

/**
 * Swagger response shapes for the mobile client payment/invoice reads:
 * `GET /mobile/client/payments` and `GET /mobile/client/payments/invoices/:id`.
 *
 * The list route narrows each staff payment row to an explicit allow-list
 * (`mobile/client/payments.controller.ts`), and the invoice route returns
 * `GetClientInvoiceResult` (which, unlike the website `/client/invoices/:id`
 * projection, still carries the frozen receipt object key in `pdfUrl`).
 * Documentation-only; the handler output is never serialized through these
 * classes.
 */

/** Invoice summary embedded on a client payment row. */
export class MobileClientPaymentInvoiceSummaryDto {
  @ApiProperty({ type: String, nullable: true, description: 'Booking UUID linked to the invoice, or null', example: '00000000-0000-4000-a000-000000000002' })
  bookingId!: string | null;

  @ApiProperty({ type: String, description: 'Invoice total in halalas, serialized as a decimal string (Prisma Decimal)', example: '20000' })
  total!: Invoice['total'];
}

/** One client-safe payment row of `GET /mobile/client/payments`. */
export class MobileClientPaymentDto {
  @ApiProperty({ format: 'uuid', description: 'Payment UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential payment number', example: 42 })
  number!: number;

  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-000000000002' })
  invoiceId!: string;

  @ApiProperty({ type: String, description: 'Amount in halalas, serialized as a decimal string (Prisma Decimal)', example: '20000' })
  amount!: Payment['amount'];

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Payment method (Prisma enum)', example: 'ONLINE_CARD' })
  method!: string;

  @ApiProperty({ description: 'Payment status (Prisma enum)', example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: Payment['createdAt'];

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Provider processing instant, or null', example: null })
  processedAt!: Payment['processedAt'];

  @ApiProperty({ type: String, format: 'date-time', description: 'Effective collection instant (received or created)', example: '2026-05-20T09:00:00.000Z' })
  collectionDate!: string;

  @ApiProperty({ type: MobileClientPaymentInvoiceSummaryDto, nullable: true, description: 'Embedded invoice summary, or null' })
  invoice!: MobileClientPaymentInvoiceSummaryDto | null;
}

/** Paginated client payment list. */
export class MobileClientPaymentListResponseDto {
  @ApiProperty({ type: [MobileClientPaymentDto], description: 'Payments on the requested page' })
  items!: MobileClientPaymentDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata' })
  meta!: ListMetaDto;
}

/** Client-safe payment row embedded on a client invoice. */
export class MobileClientInvoicePaymentDto {
  @ApiProperty({ format: 'uuid', description: 'Payment UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential payment number', example: 42 })
  number!: number;

  @ApiProperty({ type: 'number', description: 'Amount in halalas', example: 20000 })
  amount!: number;

  @ApiProperty({ type: 'number', description: 'Refunded amount in halalas', example: 0 })
  refundedAmount!: number;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Payment method (Prisma enum)', example: 'ONLINE_CARD' })
  method!: string;

  @ApiProperty({ description: 'Payment status (Prisma enum)', example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Provider processing instant, or null', example: null })
  processedAt!: string | null;
}

/**
 * `GET /mobile/client/payments/invoices/:id` — `GetClientInvoiceResult` as
 * emitted by `GetPublicInvoiceHandler.execute(invoiceId, clientId)`, including
 * the raw `pdfUrl` receipt object key (the mobile route does not project it
 * away, unlike the website `/client/invoices/:id` route).
 */
export class MobileClientInvoiceDto {
  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-000000000002' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential invoice number', example: 1024 })
  number!: number;

  @ApiProperty({ description: 'Seller name shown on the invoice', example: 'مركز سواء' })
  sellerName!: string;

  @ApiProperty({ format: 'uuid', description: 'Branch UUID', example: '00000000-0000-4000-a000-00000000000c' })
  branchId!: string;

  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-000000000003' })
  clientId!: string;

  @ApiProperty({ format: 'uuid', description: 'Employee UUID', example: '00000000-0000-4000-a000-000000000004' })
  employeeId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Booking UUID, or null', example: '00000000-0000-4000-a000-000000000002' })
  bookingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Package purchase UUID, or null', example: null })
  packagePurchaseId!: string | null;

  @ApiProperty({ type: 'number', description: 'Net amount before VAT and discount, in halalas', example: 20000 })
  subtotal!: number;

  @ApiProperty({ type: 'number', description: 'Discount amount in halalas', example: 0 })
  discountAmt!: number;

  @ApiProperty({ type: 'number', description: 'VAT rate as a fraction of 1 (0 when VAT is off)', example: 0 })
  vatRate!: number;

  @ApiProperty({ type: 'number', description: 'VAT amount in halalas', example: 0 })
  vatAmt!: number;

  @ApiProperty({ type: 'number', description: 'Invoice total in halalas', example: 20000 })
  total!: number;

  @ApiProperty({ type: 'number', description: 'Refunded amount in halalas', example: 0 })
  refundedAmount!: number;

  @ApiProperty({ type: 'number', description: 'Refunded VAT amount in halalas', example: 0 })
  refundedVatAmt!: number;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Invoice status (Prisma enum)', example: 'PAID' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Issue instant, or null', example: '2026-05-20T09:00:00.000Z' })
  issuedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Due instant, or null', example: null })
  dueAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Paid instant, or null', example: '2026-05-20T09:05:00.000Z' })
  paidAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen paid-receipt object key, or null when no receipt exists. Callers exchange it for a short-lived presigned URL.', example: null })
  pdfUrl!: string | null;

  @ApiProperty({ type: [MobileClientInvoicePaymentDto], description: 'Client-safe payments on this invoice' })
  payments!: MobileClientInvoicePaymentDto[];
}
