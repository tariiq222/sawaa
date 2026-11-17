import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus, type FcmToken, type Payment } from '@prisma/client';
import {
  BookingRecordDto,
  CancelledBookingRecordDto,
  CreatedBookingRecordDto,
} from '../../dashboard/dto/booking-record-response.dto';

/**
 * Raw persisted rows returned by the mobile client/employee write routes.
 *
 * These controllers return the Prisma record unmapped, so every column is on
 * the wire: dates are ISO strings, `Decimal` columns are decimal strings.
 * `BookingRecordDto`, `CreatedBookingRecordDto` and `CancelledBookingRecordDto`
 * already document those rows exactly (with a compile-time guard that the DTO
 * keys equal `keyof Booking`); these subclasses give the mobile audience a
 * prefixed schema name without re-declaring the columns.
 *
 * Documentation-only: no serializer is registered, so nothing here shapes the
 * response.
 */

/** Raw `Booking` row returned by client/employee booking mutations. */
export class MobileBookingRecordDto extends BookingRecordDto {}

/** Raw `Booking` row plus the invoice id, returned by booking creation. */
export class MobileCreatedBookingRecordDto extends CreatedBookingRecordDto {}

/** Raw `Booking` row plus the refund decision, returned by employee cancel. */
export class MobileCancelledBookingRecordDto extends CancelledBookingRecordDto {}

const ISO_DATE_TIME = { type: String, format: 'date-time' } as const;
const DECIMAL_STRING = { type: String } as const;

/** Raw `Payment` row returned by bank-transfer receipt upload. */
export class MobilePaymentRecordDto {
  @ApiProperty({ format: 'uuid', description: 'Payment UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential payment number', example: 42 })
  number!: number;

  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-000000000002' })
  invoiceId!: string;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Amount in halalas, serialized as a decimal string', example: '10000' })
  amount!: Payment['amount'];

  @ApiProperty({ ...DECIMAL_STRING, description: 'Refunded amount in halalas, serialized as a decimal string', example: '0' })
  refundedAmount!: Payment['refundedAmount'];

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod', description: 'Payment method', example: 'BANK_TRANSFER' })
  method!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus', description: 'Payment status', example: 'PENDING_VERIFICATION' })
  status!: PaymentStatus;

  @ApiProperty({ type: String, nullable: true, description: 'Provider gateway reference, or null', example: null })
  gatewayRef!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Idempotency key, or null', example: null })
  idempotencyKey!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Native checkout configuration fingerprint, or null', example: null })
  nativeConfigFingerprint!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Uploaded receipt object key, or null', example: 'invoices/00000000-0000-4000-a000-000000000002/receipt.png' })
  receiptUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Provider failure reason, or null', example: null })
  failureReason!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Refund lease owner, or null', example: null })
  refundProviderLeaseOwner!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Refund lease expiry, or null', example: null })
  refundProviderLeaseExpiresAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the money was actually received, or null', example: null })
  effectiveReceivedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'User who recorded a manual receipt, or null', example: null })
  receiptRecordedBy!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Manual receipt evidence reference, or null', example: null })
  receiptEvidenceRef!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Reason given for a late receipt entry, or null', example: null })
  receiptEntryReason!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Provider processing instant, or null', example: null })
  processedAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-05-20T09:00:00.000Z' })
  updatedAt!: Date;
}

/** Raw `FcmToken` row returned by the FCM registration route. */
export class MobileFcmTokenRecordDto {
  @ApiProperty({ format: 'uuid', description: 'Registration UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-000000000002' })
  clientId!: string;

  @ApiProperty({ description: 'FCM registration token', example: 'fcm-token-placeholder' })
  token!: string;

  @ApiProperty({ description: 'Device platform', example: 'ios' })
  platform!: string;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last time this device registered', example: '2026-05-20T09:00:00.000Z' })
  lastSeenAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: Date;
}

// Compile-time guards: each DTO lists exactly the columns of its Prisma row.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export const mobilePaymentRecordMatchesPrismaRow: Equal<keyof MobilePaymentRecordDto, keyof Payment> = true;
export const mobileFcmTokenRecordMatchesPrismaRow: Equal<keyof MobileFcmTokenRecordDto, keyof FcmToken> = true;
