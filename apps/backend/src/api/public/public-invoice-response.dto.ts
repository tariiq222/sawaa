import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response shapes for the public client invoice routes in
 * `src/api/public/invoices.controller.ts` and the booking-scoped invoice route
 * in `src/api/public/me.controller.ts`:
 *
 *   GET /public/invoices/{id}                 (GetClientInvoiceResult)
 *   GET /public/invoices/{id}/pdf             ({ url })
 *   GET /public/me/bookings/{id}/invoice      (GetPublicInvoiceResult)
 *
 * Documentation only: the handlers keep their inferred return types and nothing
 * under `src/modules/**` imports this layer. Money note: `mapInvoiceResult`
 * converts every Prisma `Decimal` with `Number()`, so halalas arrive as integer
 * numbers and `vatRate` as a fractional rate — never a float amount.
 *
 * `pdfUrl` on these two reads is the frozen receipt OBJECT KEY (or null), not a
 * presigned URL; only `/public/invoices/{id}/pdf` mints a short-lived link.
 */

/** One client-safe payment row embedded on a public invoice. */
export class PublicInvoicePaymentDto {
  @ApiProperty({ format: 'uuid', description: 'Payment UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential payment number', example: 42 })
  number!: number;

  @ApiProperty({ type: 'number', description: 'Payment amount in halalas', example: 20000 })
  amount!: number;

  @ApiProperty({ type: 'number', description: 'Refunded amount in halalas', example: 0 })
  refundedAmount!: number;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Payment method (Prisma enum value)', example: 'ONLINE_CARD' })
  method!: string;

  @ApiProperty({ description: 'Payment status (Prisma enum value)', example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant (ISO 8601 UTC)', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Provider processing instant, or null', example: null })
  processedAt!: string | null;
}

/** `GET /public/invoices/{id}` — the client-owned invoice with its payments. */
export class PublicInvoiceResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-000000000002' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential invoice number', example: 1024 })
  number!: number;

  @ApiProperty({ description: 'Seller name shown on the invoice', example: 'مركز سواء' })
  sellerName!: string;

  @ApiProperty({ format: 'uuid', description: 'Branch UUID', example: '00000000-0000-4000-a000-00000000000c' })
  branchId!: string;

  @ApiProperty({ format: 'uuid', description: 'Owning client UUID', example: '00000000-0000-4000-a000-000000000003' })
  clientId!: string;

  @ApiProperty({ format: 'uuid', description: 'Employee UUID on the invoice', example: '00000000-0000-4000-a000-000000000004' })
  employeeId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Booking UUID, or null for package-purchase invoices', example: '00000000-0000-4000-a000-000000000005' })
  bookingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Package purchase UUID, or null for booking invoices', example: null })
  packagePurchaseId!: string | null;

  @ApiProperty({ type: 'number', description: 'Net amount before discount and VAT, in halalas', example: 20000 })
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

  @ApiProperty({ description: 'Invoice status (Prisma enum value)', example: 'PAID' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Issue instant, or null', example: '2026-05-20T09:00:00.000Z' })
  issuedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Due instant, or null', example: null })
  dueAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Paid instant, or null', example: '2026-05-20T09:05:00.000Z' })
  paidAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant (ISO 8601 UTC)', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Frozen paid-receipt object key, or null. Not a URL: request a short-lived link from `GET /public/invoices/{id}/pdf`.',
    example: 'invoices/00000000-0000-4000-a000-000000000002/1700000000000.pdf',
  })
  pdfUrl!: string | null;

  @ApiProperty({ type: [PublicInvoicePaymentDto], description: 'Client-safe payments on this invoice, newest first' })
  payments!: PublicInvoicePaymentDto[];
}

/**
 * `GET /public/invoices/{id}/pdf` — short-lived presigned download link for the
 * paid receipt. The bare storage key is never returned here.
 */
export class PublicInvoicePdfUrlDto {
  @ApiProperty({
    type: String,
    description: 'Short-lived (5 minute) presigned download URL for the paid receipt PDF',
    example: 'https://minio.local/finance-invoices/receipts/00000000-0000-4000-a000-000000000002.pdf?X-Amz-Expires=300',
  })
  url!: string;
}

/**
 * `GET /public/me/bookings/{id}/invoice` — booking-scoped invoice
 * (`GetPublicInvoiceResult`). Unlike `GET /public/invoices/{id}` it carries no
 * invoice `number` and no `payments` array.
 */
export class PublicBookingInvoiceResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-000000000002' })
  id!: string;

  @ApiProperty({ description: 'Seller name shown on the invoice', example: 'مركز سواء' })
  sellerName!: string;

  @ApiProperty({ format: 'uuid', description: 'Branch UUID', example: '00000000-0000-4000-a000-00000000000c' })
  branchId!: string;

  @ApiProperty({ format: 'uuid', description: 'Owning client UUID', example: '00000000-0000-4000-a000-000000000003' })
  clientId!: string;

  @ApiProperty({ format: 'uuid', description: 'Employee UUID on the invoice', example: '00000000-0000-4000-a000-000000000004' })
  employeeId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Booking UUID, or null', example: '00000000-0000-4000-a000-000000000005' })
  bookingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Package purchase UUID, or null', example: null })
  packagePurchaseId!: string | null;

  @ApiProperty({ type: 'number', description: 'Net amount before discount and VAT, in halalas', example: 20000 })
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

  @ApiProperty({ description: 'Invoice status (Prisma enum value)', example: 'PAID' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Issue instant, or null', example: '2026-05-20T09:00:00.000Z' })
  issuedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Due instant, or null', example: null })
  dueAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Paid instant, or null', example: '2026-05-20T09:05:00.000Z' })
  paidAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant (ISO 8601 UTC)', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Frozen paid-receipt object key, or null. Not a URL: request a short-lived link from `GET /public/invoices/{id}/pdf`.',
    example: 'invoices/00000000-0000-4000-a000-000000000002/1700000000000.pdf',
  })
  pdfUrl!: string | null;
}
