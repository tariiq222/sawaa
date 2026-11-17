import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus, Prisma, type Payment } from '@prisma/client';

/**
 * Response shape of one persisted `Payment` row.
 *
 * Imported by the payment, invoice and refunds response DTOs so no module has
 * to import another response DTO back (no cycles). Documentation only; the
 * class is never instantiated.
 *
 * Money: the `Decimal` money columns are decimal strings on the wire.
 */

const UUID_EXAMPLE = '00000000-0000-4000-a000-0000000000a1';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** One persisted `Payment` row (list item, detail row, refund/verify/upload result). */
export class PaymentRecordDto {
  @ApiProperty({ format: 'uuid', description: 'Payment UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Sequential payment number', example: 1024 })
  number!: number;

  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-0000000000a2' })
  invoiceId!: string;

  @ApiProperty({ type: String, description: 'Payment amount in halalas (decimal string)', example: '20000' })
  amount!: Prisma.Decimal;

  @ApiProperty({ type: String, description: 'Refunded amount in halalas (decimal string)', example: '0' })
  refundedAmount!: Prisma.Decimal;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod', description: 'Payment method used', example: 'CASH' })
  method!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus', example: 'COMPLETED' })
  status!: PaymentStatus;

  @ApiProperty({ type: String, nullable: true, description: 'Provider transaction reference (Moyasar payment id), or null', example: null })
  gatewayRef!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Idempotency key stored on the row, or null', example: null })
  idempotencyKey!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'SHA-256 of the native checkout configuration, or null', example: null })
  nativeConfigFingerprint!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'MinIO receipt path, or null', example: null })
  receiptUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Failure or refund reason, or null', example: null })
  failureReason!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Provider-refund lease owner, or null', example: null })
  refundProviderLeaseOwner!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Provider-refund lease expiry, or null', example: null })
  refundProviderLeaseExpiresAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Instant the money was actually received, or null', example: null })
  effectiveReceivedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Staff user UUID that recorded the receipt, or null', example: null })
  receiptRecordedBy!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Receipt evidence reference, or null', example: null })
  receiptEvidenceRef!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Reason recorded with the receipt entry, or null', example: null })
  receiptEntryReason!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Provider processing instant, or null', example: ISO_EXAMPLE })
  processedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;
}


// Compile-time guard: the DTO must list exactly the Prisma columns.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export const paymentRecordDtoMatchesPrismaRow: Equal<keyof PaymentRecordDto, keyof Payment> = true;
