import { ApiProperty } from '@nestjs/swagger';
import {
  BookingSource,
  BookingStatus,
  BookingType,
  CancellationReason,
  DeliveryType,
  Prisma,
  RefundType,
  ZoomMeetingStatus,
  type Booking,
} from '@prisma/client';

/**
 * Raw Prisma `Booking` row as returned by the dashboard booking WRITE routes
 * (create, cancel, approve/reject-cancel, reschedule, confirm, check-in,
 * complete, no-show, restore-no-show, zoom/retry, from-credit). Those handlers
 * return the database row unmapped, so every column is on the wire: dates are
 * ISO strings, `Decimal` columns are decimal strings.
 *
 * This documents the existing response exactly; it does not shape it. No
 * response serializer is registered, so the class is never instantiated.
 */

const ISO_DATE_TIME = { type: String, format: 'date-time' } as const;
const DECIMAL_STRING = { type: String } as const;

export class BookingRecordDto {
  @ApiProperty({ description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000002' })
  id!: string;

  @ApiProperty({ description: 'Branch UUID', example: '00000000-0000-0000-0000-00000000000c' })
  branchId!: string;

  @ApiProperty({ description: 'Client UUID', example: '00000000-0000-0000-0000-000000000001' })
  clientId!: string;

  @ApiProperty({ description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000003' })
  employeeId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Service UUID; null for group-program bookings', example: '00000000-0000-0000-0000-000000000005' })
  serviceId!: string | null;

  @ApiProperty({ description: 'Appointment shape', enum: BookingType, enumName: 'BookingType', example: 'INDIVIDUAL' })
  bookingType!: BookingType;

  @ApiProperty({ description: 'Delivery channel', enum: DeliveryType, enumName: 'DeliveryType', example: 'IN_PERSON' })
  deliveryType!: DeliveryType;

  @ApiProperty({ description: 'Where the booking was created', enum: BookingSource, enumName: 'BookingSource', example: 'RECEPTION' })
  source!: BookingSource;

  @ApiProperty({ type: String, nullable: true, description: 'Client-supplied idempotency key for creation', example: null })
  creationIdempotencyKey!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Canonical hash of the creation request paired with the idempotency key', example: null })
  creationRequestHash!: string | null;

  @ApiProperty({ description: 'Booking status', enum: BookingStatus, enumName: 'BookingStatus', example: 'CONFIRMED' })
  status!: BookingStatus;

  @ApiProperty({ description: 'True for rows imported from the legacy system', example: false })
  isHistoricalImport!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the late entry was recorded', example: null })
  lateEntryRecordedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'User id who recorded the late entry', example: null })
  lateEntryRecordedBy!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Start instant (UTC)', example: '2026-06-01T09:00:00.000Z' })
  scheduledAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'End instant (UTC)', example: '2026-06-01T10:00:00.000Z' })
  endsAt!: Date;

  @ApiProperty({ description: 'Duration in minutes', example: 60 })
  durationMins!: number;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Price in halalas, serialized as a decimal string (Prisma Decimal)', example: '20000' })
  price!: Prisma.Decimal;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Free-text notes', example: null })
  notes!: string | null;

  @ApiProperty({ enum: Object.values(CancellationReason), nullable: true, description: 'Cancellation reason', example: null })
  cancelReason!: CancellationReason | null;

  @ApiProperty({ type: String, nullable: true, description: 'Free-text cancellation notes', example: null })
  cancelNotes!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Cancellation instant', example: null })
  cancelledAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Confirmation instant', example: null })
  confirmedAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Check-in instant', example: null })
  checkedInAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Instant until which automatic no-show is suppressed after a restore', example: null })
  autoNoShowSuppressedAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Completion instant', example: null })
  completedAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'No-show instant', example: null })
  noShowAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Hold expiry instant for unconfirmed bookings', example: null })
  expiresAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Service duration option UUID', example: null })
  durationOptionId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Program UUID for group bookings', example: null })
  programId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Package credit UUID when the booking consumes package credit', example: null })
  packageCreditId!: string | null;

  @ApiProperty({ description: 'Client selected payment at the center; independent of financial payment status', example: false })
  payAtClinic!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Applied coupon code', example: null })
  couponCode!: string | null;

  @ApiProperty({ ...DECIMAL_STRING, nullable: true, description: 'Discounted price in halalas, decimal string', example: null })
  discountedPrice!: Prisma.Decimal | null;

  @ApiProperty({ type: String, nullable: true, description: 'Zoom meeting id', example: null })
  zoomMeetingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Zoom join URL', example: null })
  zoomJoinUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Zoom host URL (present on write responses because the row is returned unmapped)', example: null })
  zoomHostUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Zoom start URL (present on write responses because the row is returned unmapped)', example: null })
  zoomStartUrl!: string | null;

  @ApiProperty({ enum: Object.values(ZoomMeetingStatus), nullable: true, description: 'Zoom meeting creation state', example: null })
  zoomMeetingStatus!: ZoomMeetingStatus | null;

  @ApiProperty({ type: String, nullable: true, description: 'Last Zoom creation error', example: null })
  zoomMeetingError!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the Zoom meeting was created', example: null })
  zoomMeetingCreatedAt!: Date | null;

  @ApiProperty({ description: 'Durable Zoom creation phase', example: 'BEFORE_CALL' })
  zoomCreatePhase!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Worker that holds the Zoom creation lease', example: null })
  zoomCreateLeaseOwner!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Zoom creation lease expiry', example: null })
  zoomCreateLeaseExpiresAt!: Date | null;

  @ApiProperty({ description: 'Number of Zoom creation attempts', example: 0 })
  zoomCreateAttemptCount!: number;

  @ApiProperty({ description: 'Zoom sync revision counter', example: 0 })
  zoomSyncRevision!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Worker that holds the Zoom sync lease', example: null })
  zoomSyncLeaseOwner!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Zoom sync lease expiry', example: null })
  zoomSyncLeaseExpiresAt!: Date | null;

  @ApiProperty({ ...DECIMAL_STRING, nullable: true, description: 'Price in halalas captured at booking time, decimal string', example: '20000' })
  priceSnapshot!: Prisma.Decimal | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Duration in minutes captured at booking time', example: 60 })
  durationMinutesSnapshot!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Branch name captured at booking time', example: 'Riyadh' })
  branchNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Employee name captured at booking time', example: 'Ahmed Al-Qahtani' })
  employeeNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Service name captured at booking time', example: 'Family consultation' })
  serviceNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Category name captured at booking time', example: 'Family counseling' })
  categoryNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Department name captured at booking time', example: 'Counseling' })
  departmentNameSnapshot!: string | null;

  @ApiProperty({ description: 'Human-friendly sequential booking number', example: 1024 })
  bookingNumber!: number;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-05-30T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-05-30T08:00:00.000Z' })
  updatedAt!: Date;
}

/** POST /dashboard/bookings: the created (or idempotently replayed) row plus its invoice id. */
export class CreatedBookingRecordDto extends BookingRecordDto {
  @ApiProperty({ type: String, nullable: true, description: 'Invoice UUID created with the booking; null when none exists', example: '00000000-0000-0000-0000-000000000008' })
  invoiceId!: string | null;
}

/** PATCH /dashboard/bookings/:id/cancel: the cancelled row plus the refund decision. */
export class CancelledBookingRecordDto extends BookingRecordDto {
  @ApiProperty({ description: 'Refund decision applied by the cancellation policy', enum: Object.values(RefundType), example: 'FULL' })
  refundType!: RefundType;
}

/** PATCH /dashboard/bookings/:id/approve-cancel: the cancelled row plus the auto-refund flag. */
export class ApprovedCancelBookingRecordDto extends BookingRecordDto {
  @ApiProperty({ description: 'Whether a refund was started automatically', example: false })
  autoRefund!: boolean;
}

// Compile-time guard: the DTO must list exactly the columns of the Prisma row.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export const bookingRecordDtoMatchesPrismaRow: Equal<keyof BookingRecordDto, keyof Booking> = true;
