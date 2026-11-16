import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
  ActivityAction,
  BookingStatus,
  CancellationReason,
  ClientGender,
  PaymentStatus,
} from '@prisma/client';
import { ListMetaDto } from './people-response.dto';

/**
 * Response shapes of `dashboard/ops.controller.ts`: generated reports, the
 * package-report set, the activity log and the terminal-failed outbox surface.
 *
 * These classes only document what the handlers/builders return. They are never
 * instantiated and no interceptor rewrites a payload, so they cannot change a
 * response. `platform-ops-response.dto.spec.ts` pins every class to the exported
 * result type of the builder or handler that produces it.
 *
 * `POST /dashboard/ops/reports` answers one of eight report payloads (plus an
 * optional `previous` period when `compareWithPrevious` is set), or an xlsx
 * binary that never reaches this schema. `GET /dashboard/ops/reports/packages`
 * answers the four package reports, discriminated by `kind`.
 */

const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';
const UUID_EXAMPLE = '00000000-0000-4000-a000-0000000000e1';

/* ── Overview ─────────────────────────────────────────────────────────────── */

export class OpsOverviewTrendPointDto {
  @ApiProperty({ description: 'Calendar day (yyyy-MM-dd) in the report timezone', example: '2026-01-15' })
  date!: string;

  @ApiProperty({ description: 'Revenue collected that day in integer halalas', example: 120000 })
  revenue!: number;

  @ApiProperty({ description: 'Bookings scheduled that day', example: 4 })
  bookings!: number;
}

export class OpsOverviewTopServiceDto {
  @ApiProperty({ format: 'uuid', description: 'Service UUID', example: UUID_EXAMPLE })
  serviceId!: string;

  @ApiProperty({ description: 'Arabic service name', example: 'جلسة إرشاد أسري' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English service name, or null when unset', example: null })
  nameEn!: string | null;

  @ApiProperty({ description: 'Bookings on this service in the period', example: 3 })
  count!: number;
}

export class OpsOverviewTopPractitionerDto {
  @ApiProperty({ format: 'uuid', description: 'Employee UUID', example: '00000000-0000-4000-a000-0000000000e2' })
  employeeId!: string;

  @ApiProperty({ description: 'Practitioner display name', example: 'أخصائي تجريبي' })
  name!: string;

  @ApiProperty({ description: 'Revenue attributed to this practitioner in integer halalas', example: 90000 })
  revenue!: number;

  @ApiProperty({ description: 'Bookings handled by this practitioner', example: 3 })
  bookings!: number;
}

/** `type: OVERVIEW` (`buildOverviewReport`). */
export class OpsOverviewReportDto {
  @ApiProperty({ description: 'Total collected revenue in integer halalas', example: 250000 })
  totalRevenue!: number;

  @ApiProperty({ description: 'Bookings scheduled in the period', example: 12 })
  totalBookings!: number;

  @ApiProperty({ description: 'Bookings with status COMPLETED', example: 9 })
  completedBookings!: number;

  @ApiProperty({ description: 'completedBookings ÷ totalBookings as a fraction (0–1)', example: 0.75 })
  completionRate!: number;

  @ApiProperty({ description: 'Clients created in the period', example: 5 })
  newClients!: number;

  @ApiProperty({ type: [OpsOverviewTrendPointDto], description: 'Daily revenue and booking counts' })
  trend!: OpsOverviewTrendPointDto[];

  @ApiProperty({ type: [OpsOverviewTopServiceDto], description: 'Services by booking count, descending' })
  topServices!: OpsOverviewTopServiceDto[];

  @ApiProperty({ type: [OpsOverviewTopPractitionerDto], description: 'Practitioners by revenue, descending' })
  topPractitioners!: OpsOverviewTopPractitionerDto[];

  @ApiPropertyOptional({ type: () => OpsOverviewReportDto, description: 'Same-length previous period, present only when compareWithPrevious requested it' })
  previous?: OpsOverviewReportDto;
}

/* ── Revenue ──────────────────────────────────────────────────────────────── */

export class OpsRevenueMethodRowDto {
  @ApiProperty({ description: 'Payment method as stored', example: 'CASH' })
  method!: string;

  @ApiProperty({ description: 'Collected amount in integer halalas', example: 150000 })
  amount!: number;

  @ApiProperty({ description: 'Payment count for this method', example: 4 })
  count!: number;
}

export class OpsRevenueStatusRowDto {
  @ApiProperty({ enum: PaymentStatus, description: 'Payment status', example: 'COMPLETED' })
  status!: PaymentStatus;

  @ApiProperty({ description: 'Amount in this status in integer halalas', example: 150000 })
  amount!: number;

  @ApiProperty({ description: 'Payment count in this status', example: 4 })
  count!: number;
}

export class OpsRevenueDayRowDto {
  @ApiProperty({ description: 'Collection day (yyyy-MM-dd)', example: '2026-01-15' })
  date!: string;

  @ApiProperty({ description: 'Collected amount that day in integer halalas', example: 60000 })
  amount!: number;

  @ApiProperty({ description: 'Payment count that day', example: 2 })
  count!: number;
}

export class OpsRevenueCouponRowDto {
  @ApiProperty({ description: 'Coupon code', example: 'SAWAA10' })
  code!: string;

  @ApiProperty({ description: 'Redemptions in the period', example: 3 })
  uses!: number;

  @ApiProperty({ description: 'Total discount granted in integer halalas', example: 15000 })
  discountAmount!: number;

  @ApiProperty({ description: 'Whether the coupon is still active and unexpired at report time', example: true })
  isActive!: boolean;
}

export class OpsRevenueRecentPaymentDto {
  @ApiProperty({ format: 'uuid', description: 'Payment UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Collection date as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  date!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Row creation instant as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  recordedAt?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, description: 'Provider processing instant, or null when not processed', example: null })
  processedAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Staff user UUID that recorded the receipt, or null', example: null })
  receiptRecordedBy?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Receipt evidence reference, or null', example: null })
  receiptEvidenceRef?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Reason recorded with the receipt entry, or null', example: null })
  receiptEntryReason?: string | null;

  @ApiProperty({ description: 'Client display name, empty string when unknown', example: 'عميل تجريبي' })
  clientName!: string;

  @ApiProperty({ description: 'Arabic service name, empty string when unknown', example: 'جلسة إرشاد أسري' })
  serviceName!: string;

  @ApiProperty({ description: 'Payment method as stored', example: 'CASH' })
  method!: string;

  @ApiProperty({ description: 'Payment amount in integer halalas', example: 30000 })
  amount!: number;

  @ApiProperty({ enum: PaymentStatus, description: 'Payment status', example: 'COMPLETED' })
  status!: PaymentStatus;
}

/** `type: REVENUE` (`buildRevenueReport`). */
export class OpsRevenueReportDto {
  @ApiProperty({ description: 'Total collected revenue in integer halalas', example: 250000 })
  totalRevenue!: number;

  @ApiProperty({ description: 'Revenue net of refunds in integer halalas', example: 235000 })
  netRevenue!: number;

  @ApiProperty({ description: 'Bookings summarised in the period', example: 12 })
  totalBookings!: number;

  @ApiProperty({ description: 'Total revenue ÷ total bookings in integer halalas', example: 20833 })
  averagePerBooking!: number;

  @ApiProperty({ description: 'Refunded amount in integer halalas', example: 15000 })
  refundsTotal!: number;

  @ApiProperty({ type: [OpsRevenueMethodRowDto], description: 'Revenue by payment method' })
  byMethod!: OpsRevenueMethodRowDto[];

  @ApiProperty({ type: [OpsRevenueStatusRowDto], description: 'Revenue by payment status' })
  byStatus!: OpsRevenueStatusRowDto[];

  @ApiProperty({ type: [OpsRevenueDayRowDto], description: 'Revenue by collection day' })
  byDay!: OpsRevenueDayRowDto[];

  @ApiProperty({ type: [OpsRevenueCouponRowDto], description: 'Coupons used, by redemption count' })
  couponsUsed!: OpsRevenueCouponRowDto[];

  @ApiProperty({ type: [OpsRevenueRecentPaymentDto], description: 'The ten most recent payments in the period' })
  recentPayments!: OpsRevenueRecentPaymentDto[];

  @ApiPropertyOptional({ type: () => OpsRevenueReportDto, description: 'Same-length previous period, present only when compareWithPrevious requested it' })
  previous?: OpsRevenueReportDto;
}

/* ── Bookings ─────────────────────────────────────────────────────────────── */

export class OpsBookingsStatusRowDto {
  @ApiProperty({ enum: BookingStatus, description: 'Booking status', example: 'COMPLETED' })
  status!: BookingStatus;

  @ApiProperty({ description: 'Bookings in this status', example: 9 })
  count!: number;
}

export class OpsBookingsTypeRowDto {
  @ApiProperty({ description: 'Booking type as stored', example: 'INDIVIDUAL' })
  type!: string;

  @ApiProperty({ description: 'Bookings of this type', example: 12 })
  count!: number;
}

export class OpsBookingsDayRowDto {
  @ApiProperty({ description: 'Calendar day (yyyy-MM-dd)', example: '2026-01-15' })
  date!: string;

  @ApiProperty({ description: 'Bookings that day', example: 4 })
  count!: number;
}

export class OpsBookingsHourDowRowDto {
  @ApiProperty({ description: 'Day of week (0 = Sunday)', example: 1 })
  dow!: number;

  @ApiProperty({ description: 'Hour of day (0–23)', example: 10 })
  hour!: number;

  @ApiProperty({ description: 'Bookings in this slot', example: 3 })
  count!: number;
}

export class OpsBookingsCancelReasonRowDto {
  @ApiProperty({ enum: [...Object.values(CancellationReason), 'UNSPECIFIED'], description: 'Cancellation reason, or UNSPECIFIED when none was recorded', example: 'CLIENT_REQUESTED' })
  reason!: CancellationReason | 'UNSPECIFIED';

  @ApiProperty({ description: 'Cancellations with this reason', example: 2 })
  count!: number;
}

/** `type: BOOKINGS` (`buildBookingsReport`). */
export class OpsBookingsReportDto {
  @ApiProperty({ description: 'Bookings in the period', example: 12 })
  total!: number;

  @ApiProperty({ type: [OpsBookingsStatusRowDto], description: 'Bookings by status' })
  byStatus!: OpsBookingsStatusRowDto[];

  @ApiProperty({ type: [OpsBookingsTypeRowDto], description: 'Bookings by type' })
  byType!: OpsBookingsTypeRowDto[];

  @ApiProperty({ type: [OpsBookingsDayRowDto], description: 'Bookings by day' })
  byDay!: OpsBookingsDayRowDto[];

  @ApiProperty({ description: 'No-show rate as a fraction (0–1)', example: 0.08 })
  noShowRate!: number;

  @ApiProperty({ description: 'Cancellation rate as a fraction (0–1)', example: 0.16 })
  cancelRate!: number;

  @ApiProperty({ description: 'Mean booking duration in minutes', example: 50 })
  avgDurationMins!: number;

  @ApiProperty({ type: [OpsBookingsHourDowRowDto], description: 'Bookings by weekday and hour' })
  byHourDow!: OpsBookingsHourDowRowDto[];

  @ApiProperty({ type: [OpsBookingsCancelReasonRowDto], description: 'Cancellations by reason' })
  byCancelReason!: OpsBookingsCancelReasonRowDto[];

  @ApiPropertyOptional({ type: () => OpsBookingsReportDto, description: 'Same-length previous period, present only when compareWithPrevious requested it' })
  previous?: OpsBookingsReportDto;
}

/* ── Clients ──────────────────────────────────────────────────────────────── */

export class OpsClientsGenderRowDto {
  @ApiProperty({ enum: [...Object.values(ClientGender), 'UNKNOWN'], description: 'Client gender, or UNKNOWN when unset', example: 'FEMALE' })
  gender!: ClientGender | 'UNKNOWN';

  @ApiProperty({ description: 'Clients in this bucket', example: 4 })
  count!: number;
}

export class OpsClientsAgeGroupRowDto {
  @ApiProperty({ enum: ['<18', '18-29', '30-44', '45-59', '60+', 'UNKNOWN'], description: 'Age bucket, or UNKNOWN when date of birth is unset', example: '30-44' })
  group!: '<18' | '18-29' | '30-44' | '45-59' | '60+' | 'UNKNOWN';

  @ApiProperty({ description: 'Clients in this bucket', example: 3 })
  count!: number;
}

export class OpsClientsTopByRevenueDto {
  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-0000000000e3' })
  clientId!: string;

  @ApiProperty({ description: 'Client display name', example: 'عميل تجريبي' })
  name!: string;

  @ApiProperty({ description: 'Bookings by this client', example: 4 })
  bookings!: number;

  @ApiProperty({ description: 'Revenue from this client in integer halalas', example: 120000 })
  revenue!: number;
}

/** `type: CLIENTS` (`buildClientsReport`). */
export class OpsClientsReportDto {
  @ApiProperty({ description: 'Clients with bookings in the period', example: 18 })
  total!: number;

  @ApiProperty({ description: 'Clients whose first booking fell in the period', example: 5 })
  newClients!: number;

  @ApiProperty({ description: 'Clients with an earlier booking', example: 13 })
  returningClients!: number;

  @ApiProperty({ description: 'Returning-client share as a fraction (0–1)', example: 0.72 })
  retentionRate!: number;

  @ApiProperty({ type: [OpsClientsGenderRowDto], description: 'Clients by gender' })
  byGender!: OpsClientsGenderRowDto[];

  @ApiProperty({ type: [OpsClientsAgeGroupRowDto], description: 'Clients by age bucket' })
  byAgeGroup!: OpsClientsAgeGroupRowDto[];

  @ApiProperty({ type: [OpsClientsTopByRevenueDto], description: 'Clients by revenue, descending' })
  topByRevenue!: OpsClientsTopByRevenueDto[];

  @ApiPropertyOptional({ type: () => OpsClientsReportDto, description: 'Same-length previous period, present only when compareWithPrevious requested it' })
  previous?: OpsClientsReportDto;
}

/* ── Practitioners (EMPLOYEES) ────────────────────────────────────────────── */

/** One practitioner row; also the base of the per-employee detail shape. */
export class OpsPractitionerRowDto {
  @ApiProperty({ format: 'uuid', description: 'Employee UUID', example: '00000000-0000-4000-a000-0000000000e4' })
  employeeId!: string;

  @ApiProperty({ description: 'Practitioner display name', example: 'أخصائي تجريبي' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Specialty / role label, or null when unset', example: null })
  role!: string | null;

  @ApiProperty({ description: 'Bookings handled in the period', example: 8 })
  bookings!: number;

  @ApiProperty({ description: 'Bookings completed', example: 6 })
  completedBookings!: number;

  @ApiProperty({ description: 'Completed ÷ booked as a fraction (0–1)', example: 0.75 })
  completionRate!: number;

  @ApiProperty({ description: 'Revenue attributed in integer halalas', example: 180000 })
  revenue!: number;

  @ApiProperty({ description: 'Booked minutes ÷ available minutes, capped at 1', example: 0.42 })
  utilization!: number;

  @ApiProperty({ description: 'Mean rating in the period, 0 when unrated', example: 4.5 })
  averageRating!: number;
}

/** `type: EMPLOYEES` with an `employeeId` filter (`buildPractitionerDetail`). */
export class OpsPractitionerDetailReportDto extends OpsPractitionerRowDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Calendar day (yyyy-MM-dd)', example: '2026-01-15' },
        bookings: { type: 'integer', description: 'Bookings that day', example: 2 },
        revenue: { type: 'integer', description: 'Revenue that day in integer halalas', example: 60000 },
      },
      required: ['date', 'bookings', 'revenue'],
    },
    description: 'Daily bookings and revenue for this practitioner',
  })
  byDay!: Array<{ date: string; bookings: number; revenue: number }>;

  @ApiPropertyOptional({ type: () => OpsPractitionerDetailReportDto, description: 'Same-length previous period, present only when compareWithPrevious requested it' })
  previous?: OpsPractitionerDetailReportDto;
}

/** `type: EMPLOYEES` without an `employeeId` filter (`buildPractitionersReport`). */
export class OpsPractitionersReportDto {
  @ApiProperty({ description: 'Practitioners with bookings in the period', example: 4 })
  totalActive!: number;

  @ApiProperty({ description: 'Mean revenue per practitioner in integer halalas', example: 150000 })
  avgRevenue!: number;

  @ApiProperty({ description: 'Mean utilization as a fraction (0–1)', example: 0.38 })
  avgUtilization!: number;

  @ApiProperty({ description: 'Mean rating across rated practitioners, 0 when none', example: 4.2 })
  avgRating!: number;

  @ApiProperty({ description: 'Completed bookings across all practitioners', example: 24 })
  totalCompleted!: number;

  @ApiProperty({ type: [OpsPractitionerRowDto], description: 'One row per practitioner' })
  rows!: OpsPractitionerRowDto[];

  @ApiPropertyOptional({ type: () => OpsPractitionersReportDto, description: 'Same-length previous period, present only when compareWithPrevious requested it' })
  previous?: OpsPractitionersReportDto;
}

/* ── Services ─────────────────────────────────────────────────────────────── */

export class OpsServicesRowDto {
  @ApiProperty({ format: 'uuid', description: 'Service UUID', example: UUID_EXAMPLE })
  serviceId!: string;

  @ApiProperty({ description: 'Arabic service name', example: 'جلسة إرشاد أسري' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English service name, or null when unset', example: null })
  nameEn!: string | null;

  @ApiProperty({ description: 'Bookings on this service', example: 5 })
  bookings!: number;

  @ApiProperty({ description: 'Completed bookings on this service', example: 4 })
  completedBookings!: number;

  @ApiProperty({ description: 'Revenue from this service in integer halalas', example: 120000 })
  revenue!: number;

  @ApiProperty({ description: 'Cancellation rate as a fraction (0–1)', example: 0.2 })
  cancelRate!: number;

  @ApiProperty({ description: 'Mean rating for this service, 0 when unrated', example: 4.6 })
  averageRating!: number;
}

/** `type: SERVICES` (`buildServicesReport`). */
export class OpsServicesReportDto {
  @ApiProperty({ type: [OpsServicesRowDto], description: 'One row per service with bookings in the period' })
  rows!: OpsServicesRowDto[];

  @ApiPropertyOptional({ type: () => OpsServicesReportDto, description: 'Same-length previous period, present only when compareWithPrevious requested it' })
  previous?: OpsServicesReportDto;
}

/* ── Ratings ──────────────────────────────────────────────────────────────── */

export class OpsRatingsDistributionRowDto {
  @ApiProperty({ type: 'integer', enum: [1, 2, 3, 4, 5], description: 'Star score', example: 5 })
  score!: 1 | 2 | 3 | 4 | 5;

  @ApiProperty({ description: 'Ratings with this score', example: 7 })
  count!: number;
}

export class OpsRatingsTrendPointDto {
  @ApiProperty({ description: 'Calendar day (yyyy-MM-dd)', example: '2026-01-15' })
  date!: string;

  @ApiProperty({ description: 'Mean score that day', example: 4.5 })
  average!: number;

  @ApiProperty({ description: 'Ratings that day', example: 2 })
  count!: number;
}

export class OpsRecentNegativeRatingDto {
  @ApiProperty({ format: 'uuid', description: 'Rating UUID', example: '00000000-0000-4000-a000-0000000000e5' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Rated booking UUID', example: '00000000-0000-4000-a000-0000000000e6' })
  bookingId!: string;

  @ApiProperty({ description: 'Star score (1–5)', example: 2 })
  score!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Client feedback, or null when none', example: null })
  comment!: string | null;

  @ApiProperty({ description: 'Client display name', example: 'عميل تجريبي' })
  clientName!: string;

  @ApiProperty({ description: 'Practitioner display name', example: 'أخصائي تجريبي' })
  employeeName!: string;

  @ApiProperty({ description: 'Arabic service name', example: 'جلسة إرشاد أسري' })
  serviceName!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Rating submission instant as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: string;
}

/** `type: RATINGS` (`buildRatingsReport`). */
export class OpsRatingsReportDto {
  @ApiProperty({ description: 'Mean score in the period, 0 when unrated', example: 4.4 })
  averageScore!: number;

  @ApiProperty({ description: 'Ratings submitted in the period', example: 20 })
  totalRatings!: number;

  @ApiProperty({ description: 'Ratings with score ≥ 4', example: 16 })
  positiveCount!: number;

  @ApiProperty({ description: 'Ratings with score ≤ 2', example: 3 })
  negativeCount!: number;

  @ApiProperty({ type: [OpsRatingsDistributionRowDto], description: 'Ratings by star score' })
  distribution!: OpsRatingsDistributionRowDto[];

  @ApiProperty({ type: [OpsRatingsTrendPointDto], description: 'Daily mean score' })
  trend!: OpsRatingsTrendPointDto[];

  @ApiProperty({ type: [OpsRecentNegativeRatingDto], description: 'Most recent low-score ratings' })
  recentNegative!: OpsRecentNegativeRatingDto[];

  @ApiPropertyOptional({ type: () => OpsRatingsReportDto, description: 'Same-length previous period, present only when compareWithPrevious requested it' })
  previous?: OpsRatingsReportDto;
}

/* ── Activity report ──────────────────────────────────────────────────────── */

export class OpsActivityReportPeriodDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'Window start as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  from!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Window end as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  to!: string;
}

export class OpsActivityReportTopEntityDto {
  @ApiProperty({ description: 'Entity name', example: 'Booking' })
  entity!: string;

  @ApiProperty({ description: 'Actions on this entity', example: 12 })
  count!: number;
}

export class OpsActivityReportTopActionDto {
  @ApiProperty({ description: 'Action name', example: 'UPDATE' })
  action!: string;

  @ApiProperty({ description: 'Actions of this type', example: 9 })
  count!: number;
}

export class OpsActivityReportSummaryDto {
  @ApiProperty({ description: 'Log rows in the period', example: 40 })
  totalActions!: number;

  @ApiProperty({ description: 'Distinct acting users', example: 6 })
  uniqueUsers!: number;

  @ApiProperty({ type: [OpsActivityReportTopEntityDto], description: 'Entities by action count (top ten)' })
  topEntities!: OpsActivityReportTopEntityDto[];

  @ApiProperty({ type: [OpsActivityReportTopActionDto], description: 'Actions by count' })
  topActions!: OpsActivityReportTopActionDto[];
}

export class OpsActivityReportDayRowDto {
  @ApiProperty({ description: 'Calendar day (yyyy-MM-dd)', example: '2026-01-15' })
  date!: string;

  @ApiProperty({ description: 'Actions that day', example: 9 })
  count!: number;
}

export class OpsActivityReportUserRowDto {
  @ApiProperty({ format: 'uuid', description: 'Staff user UUID (the builder only emits rows for actions that carry one)', example: UUID_EXAMPLE })
  userId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Staff user email captured with the log row, or null', example: null })
  userEmail!: string | null;

  @ApiProperty({ description: 'Actions by this actor', example: 5 })
  count!: number;
}

/**
 * `type: ACTIVITY` (`buildActivityReport`). This report is excluded from
 * `compareWithPrevious`, so it carries no `previous` key.
 */
export class OpsActivityReportDto {
  @ApiProperty({ type: OpsActivityReportPeriodDto, description: 'Reported period' })
  period!: OpsActivityReportPeriodDto;

  @ApiProperty({ type: OpsActivityReportSummaryDto, description: 'Aggregate summary of the window' })
  summary!: OpsActivityReportSummaryDto;

  @ApiProperty({ type: [OpsActivityReportDayRowDto], description: 'Actions per day' })
  byDay!: OpsActivityReportDayRowDto[];

  @ApiProperty({ type: [OpsActivityReportUserRowDto], description: 'Actions per actor (top twenty)' })
  byUser!: OpsActivityReportUserRowDto[];
}

/**
 * `POST /dashboard/ops/reports` JSON body: the payload of the requested report
 * type. The xlsx branch answers a binary body instead and is documented as
 * `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
 */
export type OpsGeneratedReportResponseDto =
  | OpsOverviewReportDto
  | OpsRevenueReportDto
  | OpsBookingsReportDto
  | OpsClientsReportDto
  | OpsPractitionersReportDto
  | OpsPractitionerDetailReportDto
  | OpsServicesReportDto
  | OpsRatingsReportDto
  | OpsActivityReportDto;

export const OPS_GENERATED_REPORT_SCHEMA = {
  oneOf: [
    { $ref: getSchemaPath(OpsOverviewReportDto) },
    { $ref: getSchemaPath(OpsRevenueReportDto) },
    { $ref: getSchemaPath(OpsBookingsReportDto) },
    { $ref: getSchemaPath(OpsClientsReportDto) },
    { $ref: getSchemaPath(OpsPractitionersReportDto) },
    { $ref: getSchemaPath(OpsPractitionerDetailReportDto) },
    { $ref: getSchemaPath(OpsServicesReportDto) },
    { $ref: getSchemaPath(OpsRatingsReportDto) },
    { $ref: getSchemaPath(OpsActivityReportDto) },
  ],
};

/* ── Package reports ──────────────────────────────────────────────────────── */

export class OpsPackageSalesBucketDto {
  @ApiProperty({ description: 'Net CASH revenue in integer halalas', example: 50000 })
  cash!: number;

  @ApiProperty({ description: 'Net MADA revenue in integer halalas', example: 70000 })
  network!: number;

  @ApiProperty({ description: 'Net ONLINE_CARD / TABBY / BANK_TRANSFER revenue in integer halalas', example: 30000 })
  electronic!: number;
}

export class OpsPackageSalesMethodRowDto {
  @ApiProperty({ description: 'Payment method as stored', example: 'MADA' })
  method!: string;

  @ApiProperty({ description: 'Net amount in integer halalas', example: 70000 })
  amount!: number;

  @ApiProperty({ description: 'Payments with this method', example: 3 })
  count!: number;
}

/** `GET /dashboard/ops/reports/packages?report=SALES`. */
export class OpsPackageSalesReportDto {
  @ApiProperty({ enum: ['SALES'], description: 'Report discriminator', example: 'SALES' })
  kind!: 'SALES';

  @ApiProperty({ description: 'Package purchases paid for in the period', example: 6 })
  purchaseCount!: number;

  @ApiProperty({ description: 'Legacy alias for netRevenue, in integer halalas', example: 150000 })
  totalRevenue!: number;

  @ApiProperty({ description: 'Gross settled package payments in integer halalas', example: 160000 })
  grossRevenue!: number;

  @ApiProperty({ description: 'Cumulative refunds on those payments in integer halalas', example: 10000 })
  refundedAmount!: number;

  @ApiProperty({ description: 'Gross revenue less refunds in integer halalas', example: 150000 })
  netRevenue!: number;

  @ApiProperty({ type: OpsPackageSalesBucketDto, description: 'Net revenue by operational channel' })
  byBucket!: OpsPackageSalesBucketDto;

  @ApiProperty({ type: [OpsPackageSalesMethodRowDto], description: 'Net revenue by raw payment method' })
  byMethod!: OpsPackageSalesMethodRowDto[];
}

/** `GET /dashboard/ops/reports/packages?report=OUTSTANDING_CREDIT`. */
export class OpsPackageOutstandingCreditReportDto {
  @ApiProperty({ enum: ['OUTSTANDING_CREDIT'], description: 'Report discriminator', example: 'OUTSTANDING_CREDIT' })
  kind!: 'OUTSTANDING_CREDIT';

  @ApiProperty({ description: 'Value of unconsumed sessions at what clients paid, in integer halalas', example: 480000 })
  outstandingLiability!: number;

  @ApiProperty({ description: 'Unconsumed sessions across all active credits', example: 32 })
  outstandingSessions!: number;

  @ApiProperty({ description: 'Credit buckets with remaining capacity', example: 7 })
  creditCount!: number;

  @ApiProperty({ description: 'Unconsumed sessions that already carry a booked appointment', example: 5 })
  reservedSessions!: number;
}

export class OpsPackageConsumptionRowDto {
  @ApiProperty({ format: 'uuid', description: 'Practitioner UUID', example: '00000000-0000-4000-a000-0000000000e7' })
  employeeId!: string;

  @ApiProperty({ description: 'Practitioner display name', example: 'أخصائي تجريبي' })
  name!: string;

  @ApiProperty({ description: 'Sessions consumed', example: 4 })
  count!: number;

  @ApiPropertyOptional({ enum: ['BOOKING', 'LEGACY_CREDIT', 'UNKNOWN', 'MIXED'], description: 'Attribution source; omitted when the row comes straight from a confirmed booking' })
  attribution?: 'BOOKING' | 'LEGACY_CREDIT' | 'UNKNOWN' | 'MIXED';
}

/** `GET /dashboard/ops/reports/packages?report=CONSUMPTION`. */
export class OpsPackageConsumptionReportDto {
  @ApiProperty({ enum: ['CONSUMPTION'], description: 'Report discriminator', example: 'CONSUMPTION' })
  kind!: 'CONSUMPTION';

  @ApiProperty({ description: 'Package sessions debited in the period', example: 18 })
  totalConsumed!: number;

  @ApiProperty({ type: [OpsPackageConsumptionRowDto], description: 'Consumption grouped by practitioner' })
  byEmployee!: OpsPackageConsumptionRowDto[];
}

export class OpsRefundHistoryReconciliationDto {
  @ApiProperty({ description: 'Whether every refund candidate reconciled into an event', example: true })
  complete!: boolean;

  @ApiProperty({ description: 'Purchases still awaiting reconciliation', example: 0 })
  unresolvedPurchaseCount!: number;
}

export class OpsRefundedPackageEventRowDto {
  @ApiProperty({ format: 'uuid', description: 'Refund event UUID', example: '00000000-0000-4000-a000-0000000000e8' })
  eventId!: string;

  @ApiProperty({ format: 'uuid', description: 'Package purchase UUID', example: '00000000-0000-4000-a000-0000000000e9' })
  purchaseId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Package UUID, or null when the purchase row is gone', example: null })
  packageId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Client UUID, or null when the purchase row is gone', example: null })
  clientId!: string | null;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Amount charged for the purchase in integer halalas, or null when unknown', example: 160000 })
  amountPaid!: number | null;

  @ApiProperty({ description: 'Refunded amount in integer halalas', example: 160000 })
  refundAmount!: number;

  @ApiProperty({ enum: ['FULL', 'PARTIAL', 'UNKNOWN'], description: 'Refund type', example: 'FULL' })
  refundType!: 'FULL' | 'PARTIAL' | 'UNKNOWN';

  @ApiProperty({ enum: ['LIVE', 'LEGACY_REQUEST', 'LEGACY_AGGREGATE'], description: 'Where the refund record came from', example: 'LIVE' })
  source!: 'LIVE' | 'LEGACY_REQUEST' | 'LEGACY_AGGREGATE';

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Refund instant as an ISO 8601 UTC timestamp, or null for an undated historical record', example: ISO_EXAMPLE })
  occurredAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Free-text note, or null', example: null })
  notes!: string | null;
}

export class OpsRefundedPackageLegacyRowDto {
  @ApiProperty({ format: 'uuid', description: 'Package purchase UUID', example: '00000000-0000-4000-a000-0000000000e9' })
  purchaseId!: string;

  @ApiProperty({ format: 'uuid', description: 'Package UUID', example: '00000000-0000-4000-a000-0000000000ea' })
  packageId!: string;

  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-0000000000e3' })
  clientId!: string;

  @ApiProperty({ description: 'Amount charged for the purchase in integer halalas', example: 160000 })
  amountPaid!: number;

  @ApiProperty({ description: 'Refunded amount in integer halalas', example: 80000 })
  refundAmount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Refund instant as an ISO 8601 UTC timestamp, or null', example: ISO_EXAMPLE })
  refundedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Free-text note, or null', example: null })
  notes!: string | null;
}

/** Undated historical refund records, reported separately from the dated events. */
export class OpsRefundedUndatedHistoryDto {
  @ApiProperty({ type: 'integer', description: 'Undated records', example: 1 })
  recordCount!: number;

  @ApiProperty({ type: 'integer', description: 'Distinct purchases behind them', example: 1 })
  purchaseCount!: number;

  @ApiProperty({ type: 'integer', description: 'Total refunded in integer halalas', example: 30000 })
  totalRefunded!: number;

  @ApiProperty({ type: [OpsRefundedPackageEventRowDto], description: 'The undated historical refund records' })
  items!: OpsRefundedPackageEventRowDto[];
}

/** `GET /dashboard/ops/reports/packages?report=REFUNDED`, reconciled history (`historyMode: EVENTS`). */
export class OpsRefundedPackagesEventsReportDto {
  @ApiProperty({ enum: ['REFUNDED'], description: 'Report discriminator', example: 'REFUNDED' })
  kind!: 'REFUNDED';

  @ApiProperty({ enum: ['EVENTS'], description: 'Which refund history was readable', example: 'EVENTS' })
  historyMode!: 'EVENTS';

  @ApiProperty({ type: OpsRefundHistoryReconciliationDto, description: 'Reconciliation state as stored (this mode is only produced when every refund reconciled)' })
  historyReconciliation!: OpsRefundHistoryReconciliationDto;

  @ApiProperty({ description: 'Refund events, excluding aggregate placeholders', example: 3 })
  eventCount!: number;

  @ApiProperty({ description: 'Distinct purchases behind those events', example: 3 })
  purchaseCount!: number;

  @ApiProperty({ description: 'Total refunded in the period in integer halalas', example: 90000 })
  totalRefunded!: number;

  @ApiProperty({ type: [OpsRefundedPackageEventRowDto], description: 'Dated refund events' })
  items!: OpsRefundedPackageEventRowDto[];

  @ApiProperty({ type: OpsRefundedUndatedHistoryDto, description: 'Refunds with no readable date, reported separately' })
  undatedHistorical!: OpsRefundedUndatedHistoryDto;
}

/** `GET /dashboard/ops/reports/packages?report=REFUNDED`, legacy history (`historyMode: LEGACY`). */
export class OpsRefundedPackagesLegacyReportDto {
  @ApiProperty({ enum: ['REFUNDED'], description: 'Report discriminator', example: 'REFUNDED' })
  kind!: 'REFUNDED';

  @ApiProperty({ enum: ['LEGACY'], description: 'Which refund history was readable', example: 'LEGACY' })
  historyMode!: 'LEGACY';

  @ApiProperty({ type: OpsRefundHistoryReconciliationDto, description: 'Reconciliation state as stored (this mode is produced when at least one purchase did not reconcile)' })
  historyReconciliation!: OpsRefundHistoryReconciliationDto;

  @ApiProperty({ description: 'Refunded purchases in the period', example: 2 })
  refundedCount!: number;

  @ApiProperty({ description: 'Total refunded in the period in integer halalas', example: 60000 })
  totalRefunded!: number;

  @ApiProperty({ type: [OpsRefundedPackageLegacyRowDto], description: 'Refunded purchases' })
  items!: OpsRefundedPackageLegacyRowDto[];
}

/** `GET /dashboard/ops/reports/packages`: one of the four package reports, discriminated by `kind`. */
export type OpsPackageReportResponseDto =
  | OpsPackageSalesReportDto
  | OpsPackageOutstandingCreditReportDto
  | OpsPackageConsumptionReportDto
  | OpsRefundedPackagesEventsReportDto
  | OpsRefundedPackagesLegacyReportDto;

export const OPS_PACKAGE_REPORT_SCHEMA = {
  oneOf: [
    { $ref: getSchemaPath(OpsPackageSalesReportDto) },
    { $ref: getSchemaPath(OpsPackageOutstandingCreditReportDto) },
    { $ref: getSchemaPath(OpsPackageConsumptionReportDto) },
    { $ref: getSchemaPath(OpsRefundedPackagesEventsReportDto) },
    { $ref: getSchemaPath(OpsRefundedPackagesLegacyReportDto) },
  ],
};

/* ── Activity log ─────────────────────────────────────────────────────────── */

export class OpsActivityLogUserDto {
  @ApiProperty({ format: 'uuid', description: 'Staff user UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ type: String, nullable: true, description: 'First name, or null when unset', example: 'سارة' })
  firstName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Last name, or null when unset', example: 'العتيبي' })
  lastName!: string | null;

  @ApiProperty({ description: 'Account email', example: 'staff@example.com' })
  email!: string;
}

/** One row of `GET /dashboard/ops/activity` (`ListActivityHandler`). */
export class OpsActivityLogEntryDto {
  @ApiProperty({ format: 'uuid', description: 'Log row identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Acting staff user UUID, or null for system actions', example: null })
  userId!: string | null;

  @ApiProperty({ enum: ActivityAction, description: 'Action performed', example: 'UPDATE' })
  action!: ActivityAction;

  @ApiProperty({ description: 'Affected entity name (returned under the key `module`)', example: 'Booking' })
  module!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Affected entity UUID, or null', example: null })
  resourceId!: string | null;

  @ApiProperty({ description: 'Human-readable description of the change', example: 'Updated booking status' })
  description!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Client IP address, or null', example: '127.0.0.1' })
  ipAddress!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Client user agent, or null', example: 'Mozilla/5.0' })
  userAgent!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'When the action occurred, as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, nullable: true, description: 'Email captured on the log row, or null', example: null })
  userEmail!: string | null;

  @ApiProperty({ type: OpsActivityLogUserDto, nullable: true, description: 'Current staff user record, or null when the user is gone or the action was systemic' })
  user!: OpsActivityLogUserDto | null;
}

/** `GET /dashboard/ops/activity` — the canonical `{ items, meta }` envelope. */
export class OpsActivityLogListResponseDto {
  @ApiProperty({ type: [OpsActivityLogEntryDto], description: 'Activity log entries on the requested page, newest first' })
  items!: OpsActivityLogEntryDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata' })
  meta!: ListMetaDto;
}

/* ── Terminal-failed outbox ───────────────────────────────────────────────── */

/**
 * One terminal FAILED `OutboxEvent` metadata row (`toFailedEventView`). The
 * event `payload` is never selected or returned.
 */
export class OpsOutboxFailedEventDto {
  @ApiProperty({ format: 'uuid', description: 'Outbox event UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Domain event type', example: 'bookings.booking.created' })
  eventType!: string;

  // `number`, not `integer`: this field was already documented as `number`
  // before this unit and the snapshot must not churn on a re-documentation.
  @ApiProperty({ type: 'number', description: 'Publish attempts so far', example: 5 })
  attemptCount!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'Event creation instant as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When it entered the terminal FAILED state, or null', example: ISO_EXAMPLE })
  failedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Sanitized and truncated failure reason, or null', example: 'Provider timeout' })
  failureReason!: string | null;
}

/** `GET /dashboard/ops/outbox/failed` — metadata only, `{ items }`. */
export class OpsOutboxFailedEventListResponseDto {
  @ApiProperty({ type: [OpsOutboxFailedEventDto], description: 'Terminal FAILED events, most recently failed first' })
  items!: OpsOutboxFailedEventDto[];
}

/**
 * `POST /dashboard/ops/outbox/{id}/retry` (`RetryFailedOutboxEventHandler`).
 * The row is reset for publishing; `status` is the durable delivery lane it was
 * returned to, so `PENDING_V2` appears for events created on that lane.
 */
export class OpsOutboxRetryResponseDto extends OpsOutboxFailedEventDto {
  @ApiProperty({ enum: ['PENDING', 'PENDING_V2'], description: 'Delivery-lane status the event was reset to', example: 'PENDING' })
  status!: 'PENDING' | 'PENDING_V2';
}
