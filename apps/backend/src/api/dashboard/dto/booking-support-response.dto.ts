import { ApiProperty } from '@nestjs/swagger';
import {
  BookingStatus,
  DeliveryType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundStatus,
  type BookingStatusLog,
  type PackageCredit,
} from '@prisma/client';

/**
 * Response shapes of the smaller dashboard booking routes: stats, availability,
 * status log, timeline, matching credits and credit transfer. They document the
 * values the handlers already return; nothing here is instantiated or applied
 * to a response.
 */

const ISO_DATE_TIME = { type: String, format: 'date-time' } as const;
const DECIMAL_STRING = { type: String } as const;

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

// ── GET /dashboard/bookings/stats ───────────────────────────────────────────

export class BookingsStatsResponseDto {
  @ApiProperty({ description: 'Bookings scheduled today', example: 12 })
  todayCount!: number;

  @ApiProperty({ description: 'Today\'s bookings that are PENDING, AWAITING_PAYMENT or CONFIRMED', example: 3 })
  pendingCount!: number;

  @ApiProperty({ description: 'Bookings completed today', example: 7 })
  completedToday!: number;

  @ApiProperty({ description: 'Revenue of today\'s completed bookings, in halalas', example: 150000 })
  revenueToday!: number;
}

// ── GET /dashboard/bookings/availability ────────────────────────────────────

export class BookingAvailableSlotDto {
  @ApiProperty({ ...ISO_DATE_TIME, description: 'Slot start (UTC)', example: '2026-06-01T09:00:00.000Z' })
  startTime!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Slot end (UTC)', example: '2026-06-01T10:00:00.000Z' })
  endTime!: Date;
}

// ── GET /dashboard/bookings/:id/status-log ──────────────────────────────────

export class BookingStatusLogEntryDto {
  @ApiProperty({ description: 'Log entry UUID', example: '00000000-0000-0000-0000-00000000000d' })
  id!: string;

  @ApiProperty({ description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000002' })
  bookingId!: string;

  @ApiProperty({ enum: Object.values(BookingStatus), nullable: true, description: 'Previous status; null for the first entry', example: 'PENDING' })
  fromStatus!: BookingStatus | null;

  @ApiProperty({ enum: Object.values(BookingStatus), description: 'New status', example: 'CONFIRMED' })
  toStatus!: BookingStatus;

  @ApiProperty({ description: 'Who made the change (user id or system actor)', example: '00000000-0000-0000-0000-000000000007' })
  changedBy!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Reason given for the change', example: null })
  reason!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Idempotency id of the originating action', example: null })
  sourceActionId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Hash of the originating action request', example: null })
  sourceActionHash!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true, description: 'Stored result of the originating action (free-form JSON)', example: null })
  sourceActionResult!: Prisma.JsonValue | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'When the transition happened', example: '2026-05-30T09:00:00.000Z' })
  createdAt!: Date;
}

// ── GET /dashboard/bookings/:id/timeline ────────────────────────────────────

export class BookingTimelineEntryDto {
  @ApiProperty({ description: 'Entry id, prefixed by its source (for example payment:<uuid>)', example: 'payment:00000000-0000-0000-0000-000000000006' })
  id!: string;

  @ApiProperty({ description: 'Kind of event', enum: ['CREATED', 'STATUS_CHANGE', 'RESCHEDULE', 'PAYMENT', 'REFUND', 'ACTIVITY'], example: 'PAYMENT' })
  kind!: 'CREATED' | 'STATUS_CHANGE' | 'RESCHEDULE' | 'PAYMENT' | 'REFUND' | 'ACTIVITY';

  @ApiProperty({ ...ISO_DATE_TIME, description: 'When the event occurred', example: '2026-05-30T09:00:00.000Z' })
  at!: string;

  @ApiProperty({ type: String, nullable: true, description: 'User id, email or system actor that triggered it', example: '00000000-0000-0000-0000-000000000007' })
  actor!: string | null;

  @ApiProperty({ enum: Object.values(BookingStatus), nullable: true, description: 'Previous status (status changes)', example: 'PENDING' })
  fromStatus!: BookingStatus | null;

  @ApiProperty({ enum: Object.values(BookingStatus), nullable: true, description: 'New status (status changes)', example: 'CONFIRMED' })
  toStatus!: BookingStatus | null;

  @ApiProperty({ type: String, nullable: true, description: 'Reason or description', example: null })
  reason!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Money in integer halalas (payment and refund entries only)', example: 20000 })
  amount!: number | null;

  @ApiProperty({ enum: Object.values(PaymentMethod), nullable: true, description: 'Payment method (payment entries)', example: 'CASH' })
  method!: PaymentMethod | null;

  @ApiProperty({ enum: Object.values(PaymentStatus), nullable: true, description: 'Payment status (payment entries)', example: 'COMPLETED' })
  paymentStatus!: PaymentStatus | null;

  @ApiProperty({ enum: Object.values(RefundStatus), nullable: true, description: 'Refund status (refund entries)', example: null })
  refundStatus!: RefundStatus | null;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true, description: 'Structured extras such as fromScheduledAt/toScheduledAt for reschedules', example: null })
  meta!: Record<string, unknown> | null;
}

// ── GET /dashboard/bookings/matching-credits ────────────────────────────────

export class MatchingCreditAvailabilityDto {
  @ApiProperty({ description: 'Whether the credit can be booked now', example: true })
  bookable!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Why the credit is not bookable; null when bookable', example: null })
  reason!: string | null;
}

export class MatchingCreditDto {
  @ApiProperty({ description: 'Package credit UUID', example: '00000000-0000-0000-0000-000000000009' })
  creditId!: string;

  @ApiProperty({ description: 'Package purchase UUID', example: '00000000-0000-0000-0000-00000000000a' })
  purchaseId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned service UUID; null on flexible (rule-based) credits', example: '00000000-0000-0000-0000-000000000005' })
  serviceId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned employee UUID; null on flexible credits', example: '00000000-0000-0000-0000-000000000003' })
  employeeId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned duration option UUID; null on flexible credits', example: '00000000-0000-0000-0000-000000000010' })
  durationOptionId!: string | null;

  @ApiProperty({ description: 'Total sessions in the credit', example: 5 })
  totalQuantity!: number;

  @ApiProperty({ description: 'Sessions already delivered', example: 1 })
  usedQuantity!: number;

  @ApiProperty({ description: 'Sessions booked but not yet delivered (they occupy a seat)', example: 1 })
  reservedQuantity!: number;

  @ApiProperty({ description: 'totalQuantity - usedQuantity - reservedQuantity', example: 3 })
  remaining!: number;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Credit creation instant', example: '2026-05-30T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: 'Package model version', enum: ['LEGACY', 'GROUPED_V2'], example: 'LEGACY' })
  modelVersion!: 'LEGACY' | 'GROUPED_V2';

  @ApiProperty({ type: String, nullable: true, description: 'Purchase group UUID (grouped packages)', example: null })
  purchaseGroupId!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Position of the session inside its group', example: null })
  sessionPosition!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Group label (grouped packages)', example: null })
  groupLabel!: string | null;

  @ApiProperty({ enum: ['ORDERED', 'UNORDERED'], nullable: true, description: 'Whether group sessions must be consumed in order', example: null })
  sequenceMode!: 'ORDERED' | 'UNORDERED' | null;

  @ApiProperty({ type: String, nullable: true, description: 'Group this one depends on', example: null })
  dependsOnGroupId!: string | null;

  @ApiProperty({ type: MatchingCreditAvailabilityDto, description: 'Computed availability of the credit' })
  availability!: MatchingCreditAvailabilityDto;
}

// ── POST /dashboard/bookings/credits/:creditId/transfer ─────────────────────

/** Raw Prisma `PackageCredit` row (decimal columns are decimal strings on the wire). */
export class PackageCreditRecordDto {
  @ApiProperty({ description: 'Package credit UUID', example: '00000000-0000-0000-0000-000000000009' })
  id!: string;

  @ApiProperty({ description: 'Package purchase UUID', example: '00000000-0000-0000-0000-00000000000a' })
  purchaseId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Purchase group UUID', example: null })
  purchaseGroupId!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Position of the session inside its group', example: null })
  sessionPosition!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned service UUID', example: '00000000-0000-0000-0000-000000000005' })
  serviceId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Practitioner the credit now points to', example: '00000000-0000-0000-0000-000000000003' })
  employeeId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned duration option UUID', example: '00000000-0000-0000-0000-000000000010' })
  durationOptionId!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Frozen duration in minutes', example: 60 })
  durationMinsSnapshot!: number | null;

  @ApiProperty({ enum: Object.values(DeliveryType), nullable: true, description: 'Frozen delivery channel', example: 'IN_PERSON' })
  deliveryTypeSnapshot!: DeliveryType | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen service name', example: 'Family consultation' })
  serviceNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen employee name', example: 'Ahmed Al-Qahtani' })
  employeeNameSnapshot!: string | null;

  @ApiProperty({ ...DECIMAL_STRING, nullable: true, description: 'Frozen list price in halalas, decimal string', example: '20000' })
  listPriceSnapshot!: Prisma.Decimal | null;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Frozen unit price in halalas, decimal string', example: '18000' })
  unitPriceSnapshot!: Prisma.Decimal;

  @ApiProperty({ ...DECIMAL_STRING, nullable: true, description: 'Net amount paid for the credit in halalas, decimal string', example: '90000' })
  netValue!: Prisma.Decimal | null;

  @ApiProperty({ description: 'Total sessions in the credit', example: 5 })
  totalQuantity!: number;

  @ApiProperty({ description: 'Sessions already delivered', example: 1 })
  usedQuantity!: number;

  @ApiProperty({ description: 'Sessions booked but not yet delivered', example: 1 })
  reservedQuantity!: number;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Credit creation instant', example: '2026-05-30T09:00:00.000Z' })
  createdAt!: Date;
}

export const bookingStatusLogDtoMatchesPrismaRow: Equal<keyof BookingStatusLogEntryDto, keyof BookingStatusLog> = true;
export const packageCreditRecordDtoMatchesPrismaRow: Equal<keyof PackageCreditRecordDto, keyof PackageCredit> = true;
