import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response shapes for the authenticated CLIENT invoice routes under
 * `src/api/client/invoices.controller.ts`:
 *
 *  - `GET /client/invoices`              (paginated list + outstanding balance)
 *  - `GET /client/invoices/:id`          (detail with `hasReceipt`)
 *  - `GET /client/invoices/:id/pdf`      (short-lived presigned receipt URL)
 *  - `GET /client/bookings/:id/invoice`  (invoice for one booking)
 *
 * Money is integer halalas in every projection here (the handlers map the
 * Prisma `Decimal` columns with `Number()`); `vatRate` is a fractional rate.
 * Documentation only — no serializer is registered.
 */

/** One client-safe payment row embedded on a client invoice. */
export class ClientInvoicePaymentDto {
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
 * `GET /client/invoices/:id` and `GET /client/bookings/:id/invoice` — the
 * shared client invoice projection (`GetPublicInvoiceResult` + `number` +
 * `payments`) with the frozen receipt storage key replaced by `hasReceipt`.
 */
export class ClientInvoiceDto {
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

  @ApiProperty({
    description:
      'Whether a paid receipt PDF exists. Fetch it with `GET /client/invoices/:id/pdf`; the receipt storage key is never returned on these routes.',
    example: true,
  })
  hasReceipt!: boolean;

  @ApiProperty({ type: [ClientInvoicePaymentDto], description: 'Client-safe payments on this invoice' })
  payments!: ClientInvoicePaymentDto[];
}

/** One row of `GET /client/invoices` (`ListClientInvoicesHandler` projection). */
export class ClientInvoiceListItemDto {
  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-000000000002' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential invoice number', example: 1024 })
  number!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Related booking UUID, or null', example: '00000000-0000-4000-a000-000000000002' })
  bookingId!: string | null;

  @ApiProperty({ description: 'Service name snapshot, or an empty string when absent', example: 'Family consultation' })
  serviceName!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Appointment start instant, or null', example: '2026-05-20T07:00:00.000Z' })
  scheduledAt!: string | null;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Subtotal in halalas', example: 20000 })
  subtotal!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Discount amount in halalas', example: 0 })
  discountAmt!: number;

  @ApiProperty({ type: 'number', minimum: 0, description: 'VAT rate as a fraction of 1 (0 when VAT is off)', example: 0 })
  vatRate!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'VAT amount in halalas', example: 0 })
  vatAmt!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Invoice total in halalas', example: 20000 })
  total!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Refunded amount in halalas', example: 0 })
  refundedAmount!: number;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Invoice status (Prisma enum)', example: 'PAID' })
  status!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Latest payment status (Prisma enum), or null when no payment exists', example: 'COMPLETED' })
  paymentStatus!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Issue instant, or null', example: '2026-05-20T09:00:00.000Z' })
  issuedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Paid instant, or null', example: '2026-05-20T09:05:00.000Z' })
  paidAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: string;
}

/** `GET /client/invoices` — paginated client invoices plus the overall balance. */
export class ClientInvoiceListResponseDto {
  @ApiProperty({ type: [ClientInvoiceListItemDto], description: 'Invoices on the requested page' })
  items!: ClientInvoiceListItemDto[];

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Total matching invoices', example: 8 })
  total!: number;

  @ApiProperty({ type: 'integer', minimum: 1, description: '1-based page number', example: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1, description: 'Records per page', example: 20 })
  pageSize!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Outstanding balance across all client invoices, in halalas', example: 25000 })
  outstandingBalance!: number;
}

/** `GET /client/invoices/:id/pdf` — short-lived presigned receipt URL. */
export class ClientInvoicePdfUrlDto {
  @ApiProperty({
    type: String,
    description: 'Short-lived presigned download URL for the paid receipt PDF (5 minutes)',
    example: 'https://minio.local/finance-invoices/receipts/00000000-0000-4000-a000-000000000002.pdf?X-Amz-Expires=300',
  })
  url!: string;
}
