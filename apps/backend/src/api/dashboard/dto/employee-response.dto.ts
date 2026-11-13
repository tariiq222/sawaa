import { ApiProperty } from '@nestjs/swagger';
import {
  DeliveryType,
  EmployeeGender,
  EmploymentType,
  OnboardingStatus,
  Prisma,
} from '@prisma/client';
import { EmployeeResponseDto } from './people-response.dto';

/**
 * Response shapes of the dashboard employee endpoints.
 *
 * These classes only document what the handlers return. They are never
 * instantiated and no interceptor rewrites the payload, so they cannot change
 * a response. Every property here is traced to a handler, its Prisma select or
 * its mapper; `employee-response.dto.spec.ts` pins DTO keys to those outputs.
 */

const ISO_DATE_TIME = { type: String, format: 'date-time' } as const;
const DECIMAL_STRING = { type: String } as const;

// ── Availability / breaks / exceptions ──────────────────────────────────────

/** A raw `EmployeeAvailability` row (GET and PATCH availability). */
export class EmployeeAvailabilityWindowRecordDto {
  @ApiProperty({ description: 'Availability window UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000010' })
  id!: string;

  @ApiProperty({ description: 'Employee UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  employeeId!: string;

  @ApiProperty({ type: 'integer', description: 'Day of week (0 = Sunday, 6 = Saturday)', minimum: 0, maximum: 6, example: 1 })
  dayOfWeek!: number;

  @ApiProperty({ description: 'Window start time (HH:MM)', example: '09:00' })
  startTime!: string;

  @ApiProperty({ description: 'Window end time (HH:MM)', example: '17:00' })
  endTime!: string;

  @ApiProperty({ description: 'Whether the window is active', example: true })
  isActive!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

/** A raw `EmployeeAvailabilityException` row (vacations and availability exceptions). */
export class EmployeeAvailabilityExceptionRecordDto {
  @ApiProperty({ description: 'Availability exception UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000011' })
  id!: string;

  @ApiProperty({ description: 'Employee UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  employeeId!: string;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Inclusive first date of the time-off range', example: '2026-09-20T00:00:00.000Z' })
  startDate!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Inclusive last date of the time-off range', example: '2026-09-21T00:00:00.000Z' })
  endDate!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Partial-day end instant; null means end of day', example: null })
  endTime!: Date | null;

  @ApiProperty({ description: 'When true only the start instant matters (full-day leave)', example: false })
  isStartTimeOnly!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Reason for the time-off exception', example: 'Annual leave' })
  reason!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-09-01T00:00:00.000Z' })
  createdAt!: Date;
}

/** A raw `EmployeeBreak` row (GET and PUT breaks). */
export class EmployeeBreakRecordDto {
  @ApiProperty({ description: 'Break UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000012' })
  id!: string;

  @ApiProperty({ description: 'Employee UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  employeeId!: string;

  @ApiProperty({ type: 'integer', description: 'Day of week (0 = Sunday, 6 = Saturday)', minimum: 0, maximum: 6, example: 1 })
  dayOfWeek!: number;

  @ApiProperty({ description: 'Break start time (HH:MM)', example: '13:00' })
  startTime!: string;

  @ApiProperty({ description: 'Break end time (HH:MM)', example: '14:00' })
  endTime!: string;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

/** GET /dashboard/people/employees/:id/availability (`getAvailability.execute`). */
export class EmployeeScheduleResponseDto {
  @ApiProperty({ type: [EmployeeAvailabilityWindowRecordDto], description: 'Recurring weekly availability windows' })
  schedule!: EmployeeAvailabilityWindowRecordDto[];

  @ApiProperty({ type: [EmployeeAvailabilityExceptionRecordDto], description: 'Date-range availability exceptions' })
  exceptions!: EmployeeAvailabilityExceptionRecordDto[];
}

/** PATCH /dashboard/people/employees/:id/availability (`updateAvailability.execute`). */
export class EmployeeAvailabilityUpdateResponseDto {
  @ApiProperty({ type: [EmployeeAvailabilityWindowRecordDto], description: 'Persisted availability windows' })
  windows!: EmployeeAvailabilityWindowRecordDto[];

  @ApiProperty({ type: [EmployeeAvailabilityExceptionRecordDto], description: 'Persisted availability exceptions' })
  exceptions!: EmployeeAvailabilityExceptionRecordDto[];
}

/** GET and PUT /dashboard/people/employees/:id/breaks. */
export class EmployeeBreaksResponseDto {
  @ApiProperty({ type: [EmployeeBreakRecordDto], description: 'Break windows for the employee' })
  breaks!: EmployeeBreakRecordDto[];
}

/** An available booking slot (GET /dashboard/people/employees/:id/slots). */
export class EmployeeSlotDto {
  @ApiProperty({ description: 'Slot start time (HH:MM UTC)', example: '09:00' })
  startTime!: string;

  @ApiProperty({ description: 'Slot end time (HH:MM UTC)', example: '09:30' })
  endTime!: string;
}

// ── Employee services ───────────────────────────────────────────────────────

/** A raw `EmployeeService` link row (assign and update responses). */
export class EmployeeServiceRecordDto {
  @ApiProperty({ description: 'EmployeeService link UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000020' })
  id!: string;

  @ApiProperty({ description: 'Employee UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  employeeId!: string;

  @ApiProperty({ description: 'Service UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000030' })
  serviceId!: string;

  @ApiProperty({ description: 'Whether the link is active', example: true })
  isActive!: boolean;

  @ApiProperty({ type: 'integer', description: 'Buffer minutes after a session for this link', example: 10 })
  bufferMinutes!: number;

  @ApiProperty({
    description: 'Delivery types this practitioner does not offer for the service',
    enum: ['IN_PERSON', 'ONLINE'],
    isArray: true,
    example: [],
  })
  disabledDeliveryTypes!: DeliveryType[];

  @ApiProperty({ description: 'Whether the practitioner prices this service from owned duration rows', example: false })
  useCustomPricing!: boolean;
}

/** A raw `Service` row as embedded in the employee-services list. */
export class ServiceRecordDto {
  @ApiProperty({ description: 'Service UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000030' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential service reference', example: 42 })
  ref!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Owning category UUID', example: null })
  categoryId!: string | null;

  @ApiProperty({ description: 'Service name (Arabic)', example: 'استشارة أسرية' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Service name (English)', example: 'Family consultation' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Description (Arabic)', example: null })
  descriptionAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Description (English)', example: null })
  descriptionEn!: string | null;

  @ApiProperty({ type: 'integer', description: 'Default duration in minutes', example: 60 })
  durationMins!: number;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Price in halalas, decimal string', example: '30000' })
  price!: Prisma.Decimal;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Stored image reference', example: null })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Whether the service is active', example: true })
  isActive!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Archive instant', example: null })
  archivedAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Whether the service is hidden from the catalog', example: false })
  isHidden!: boolean;

  @ApiProperty({ description: 'Whether the price is hidden on the booking surface', example: false })
  hidePriceOnBooking!: boolean;

  @ApiProperty({ description: 'Whether the duration is hidden on the booking surface', example: false })
  hideDurationOnBooking!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Icon name', example: null })
  iconName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Icon background colour token', example: null })
  iconBgColor!: string | null;

  @ApiProperty({ type: 'integer', description: 'Buffer minutes after a session', example: 0 })
  bufferMinutes!: number;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Minimum lead time in minutes', example: null })
  minLeadMinutes!: number | null;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Maximum advance booking window in days', example: null })
  maxAdvanceDays!: number | null;

  @ApiProperty({ description: 'Whether a deposit is required', example: false })
  depositEnabled!: boolean;

  @ApiProperty({ ...DECIMAL_STRING, nullable: true, description: 'Deposit amount in halalas, decimal string', example: null })
  depositAmount!: Prisma.Decimal | null;

  @ApiProperty({ ...DECIMAL_STRING, nullable: true, description: 'Per-service commission rate override (0–1), decimal string', example: null })
  commissionRateOverride!: Prisma.Decimal | null;
}

/** GET /dashboard/people/employees/:id/services (`listEmployeeServices.execute`). */
export class EmployeeAssignedServiceDto extends EmployeeServiceRecordDto {
  @ApiProperty({ type: ServiceRecordDto, nullable: true, description: 'Service row; null when the service no longer exists' })
  service!: ServiceRecordDto | null;
}

/** A raw `ServiceDurationOption` row. */
export class ServiceDurationOptionRecordDto {
  @ApiProperty({ description: 'Duration option UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000040' })
  id!: string;

  @ApiProperty({ description: 'Service UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000030' })
  serviceId!: string;

  @ApiProperty({ description: 'Delivery type', enum: ['IN_PERSON', 'ONLINE'], example: 'IN_PERSON' })
  deliveryType!: DeliveryType;

  @ApiProperty({ description: 'Label (English)', example: '60 min' })
  label!: string;

  @ApiProperty({ description: 'Label (Arabic)', example: '60 دقيقة' })
  labelAr!: string;

  @ApiProperty({ type: 'integer', description: 'Duration in minutes', example: 60 })
  durationMins!: number;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Price in halalas, decimal string', example: '30000' })
  price!: Prisma.Decimal;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Whether this is the default option', example: true })
  isDefault!: boolean;

  @ApiProperty({ type: 'integer', description: 'Display order', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Whether the option is active', example: true })
  isActive!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: String, nullable: true, description: 'Owning EmployeeService link UUID for practitioner-owned rows', example: null })
  employeeServiceId!: string | null;
}

/** A raw `EmployeeServiceOption` row with its duration option (PUT .../options). */
export class EmployeeServiceOptionRecordDto {
  @ApiProperty({ description: 'Employee service option UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000050' })
  id!: string;

  @ApiProperty({ description: 'EmployeeService link UUID', example: '00000000-0000-4000-a000-000000000020' })
  employeeServiceId!: string;

  @ApiProperty({ description: 'Service duration option UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000040' })
  durationOptionId!: string;

  @ApiProperty({ ...DECIMAL_STRING, nullable: true, description: 'Price override in halalas, decimal string', example: null })
  priceOverride!: Prisma.Decimal | null;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Duration override in minutes', example: null })
  durationOverride!: number | null;

  @ApiProperty({ description: 'Delivery type', enum: ['IN_PERSON', 'ONLINE'], example: 'IN_PERSON' })
  deliveryType!: DeliveryType;

  @ApiProperty({ description: 'Whether the override is active', example: true })
  isActive!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: ServiceDurationOptionRecordDto, description: 'The overridden duration option' })
  durationOption!: ServiceDurationOptionRecordDto;
}

/** A duration option inside GET .../services/:serviceId/types. */
export class EmployeeServiceTypeDurationOptionDto {
  @ApiProperty({ description: 'Duration option UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000040' })
  id!: string;

  @ApiProperty({ description: 'Synthetic employee-service type id', example: 'link-uuid:IN_PERSON' })
  employeeServiceTypeId!: string;

  @ApiProperty({ description: 'Label (English)', example: '60 min' })
  label!: string;

  @ApiProperty({ description: 'Label (Arabic)', example: '60 دقيقة' })
  labelAr!: string;

  @ApiProperty({ type: 'integer', description: 'Effective duration in minutes', example: 60 })
  durationMinutes!: number;

  @ApiProperty({ description: 'Effective price in halalas', example: 30000 })
  price!: number;

  @ApiProperty({ description: 'Whether this is the default option', example: true })
  isDefault!: boolean;

  @ApiProperty({ type: 'integer', description: 'Display order', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Whether the option is active', example: true })
  isActive!: boolean;
}

/** GET /dashboard/people/employees/:id/services/:serviceId/types. */
export class EmployeeServiceTypeDto {
  @ApiProperty({ description: 'Synthetic type id (`<employeeServiceId>:<deliveryType>`)', example: 'link-uuid:IN_PERSON' })
  id!: string;

  @ApiProperty({ description: 'EmployeeService link UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000020' })
  employeeServiceId!: string;

  @ApiProperty({ description: 'Delivery type', enum: ['IN_PERSON', 'ONLINE'], example: 'IN_PERSON' })
  deliveryType!: DeliveryType;

  @ApiProperty({ description: 'Legacy alias of deliveryType (deprecated)', example: 'IN_PERSON' })
  bookingType!: DeliveryType;

  @ApiProperty({ description: 'Top-level price in halalas', example: 30000 })
  price!: number;

  @ApiProperty({ type: 'integer', description: 'Top-level duration in minutes', example: 60 })
  duration!: number;

  @ApiProperty({ description: 'Whether the practitioner has scoped duration rows for this type', example: true })
  useCustomOptions!: boolean;

  @ApiProperty({ description: 'Whether the type is bookable', example: true })
  isActive!: boolean;

  @ApiProperty({ type: [EmployeeServiceTypeDurationOptionDto], description: 'Effective duration options for this type' })
  durationOptions!: EmployeeServiceTypeDurationOptionDto[];
}

/** A per-delivery-type entry of PUT .../custom-pricing. */
export class EmployeeCustomPricingTypeDto {
  @ApiProperty({ description: 'Synthetic type id (`<employeeServiceId>:<deliveryType>`)', example: 'link-uuid:IN_PERSON' })
  id!: string;

  @ApiProperty({ description: 'Delivery type', enum: ['IN_PERSON', 'ONLINE'], example: 'IN_PERSON' })
  deliveryType!: DeliveryType;

  @ApiProperty({ description: 'Legacy alias of deliveryType (deprecated)', example: 'IN_PERSON' })
  bookingType!: DeliveryType;

  @ApiProperty({ type: 'integer', description: 'Effective price in halalas', example: 30000 })
  price!: number;

  @ApiProperty({ type: 'integer', description: 'Effective duration in minutes', example: 60 })
  durationMins!: number;

  @ApiProperty({ type: 'integer', description: 'Service-level base price in halalas', example: 25000 })
  basePrice!: number;

  @ApiProperty({ type: 'integer', description: 'Service-level base duration in minutes', example: 50 })
  baseDurationMins!: number;

  @ApiProperty({ description: 'Whether an override is applied', example: true })
  isCustom!: boolean;

  @ApiProperty({ description: 'Always true for returned entries', example: true })
  isActive!: boolean;
}

/** PUT /dashboard/people/employees/:employeeId/services/:serviceId/custom-pricing. */
export class EmployeeCustomPricingResponseDto {
  @ApiProperty({ description: 'Whether any active override carries a custom price or duration', example: true })
  hasCustomPricing!: boolean;

  @ApiProperty({ type: [EmployeeCustomPricingTypeDto], description: 'Active overrides grouped by delivery type' })
  serviceTypes!: EmployeeCustomPricingTypeDto[];
}

/** A duration row in PUT .../durations (`resolveEffectiveDurations`). */
export class EmployeeEffectiveDurationDto {
  @ApiProperty({ description: 'Duration option UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000040' })
  id!: string;

  @ApiProperty({ description: 'Delivery type', example: 'IN_PERSON' })
  deliveryType!: string;

  @ApiProperty({ description: 'Label (English)', example: '60 min' })
  label!: string;

  @ApiProperty({ description: 'Label (Arabic)', example: '60 دقيقة' })
  labelAr!: string;

  @ApiProperty({ type: 'integer', description: 'Duration in minutes', example: 60 })
  durationMins!: number;

  @ApiProperty({ type: 'integer', description: 'Price in halalas (converted from Decimal)', example: 30000 })
  price!: number;

  @ApiProperty({ description: 'Whether the row is inherited from the service defaults', example: false })
  isInherited!: boolean;
}

/** A delivery-type group in PUT .../durations. */
export class EmployeeEffectiveDurationGroupDto {
  @ApiProperty({ description: 'Delivery type', example: 'IN_PERSON' })
  deliveryType!: string;

  @ApiProperty({ type: [EmployeeEffectiveDurationDto], description: 'Effective duration rows for this type' })
  durations!: EmployeeEffectiveDurationDto[];
}

/** PUT /dashboard/people/employees/:id/services/:serviceId/delivery-types. */
export class EmployeeDeliveryTypesResponseDto {
  @ApiProperty({
    description: 'Persisted disabled delivery types',
    enum: ['IN_PERSON', 'ONLINE'],
    isArray: true,
    example: ['ONLINE'],
  })
  disabledDeliveryTypes!: DeliveryType[];
}

/** PUT /dashboard/people/employees/:id/services/:serviceId/pricing-mode. */
export class EmployeePricingModeResponseDto {
  @ApiProperty({ description: 'Persisted custom-pricing flag', example: true })
  useCustomPricing!: boolean;
}

// ── Ratings ─────────────────────────────────────────────────────────────────

/** A raw `Rating` row (GET /dashboard/people/employees/:id/ratings). */
export class EmployeeRatingRecordDto {
  @ApiProperty({ description: 'Rating UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000060' })
  id!: string;

  @ApiProperty({ description: 'Rated booking UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000070' })
  bookingId!: string;

  @ApiProperty({ description: 'Client UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000080' })
  clientId!: string;

  @ApiProperty({ description: 'Employee UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  employeeId!: string;

  @ApiProperty({ description: 'Score from one to five', minimum: 1, maximum: 5, example: 5 })
  score!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Review comment', example: 'Excellent session' })
  comment!: string | null;

  @ApiProperty({ description: 'Whether the rating is approved for public display', example: false })
  isPublic!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;
}

/**
 * Pagination metadata for the ratings list. Separate from `ListMetaDto`
 * because this endpoint documented integer counters, and the shared DTO is
 * `number` on other surfaces.
 */
export class EmployeeRatingListMetaDto {
  @ApiProperty({ type: 'integer', description: 'Total matching ratings', example: 42 })
  total!: number;

  @ApiProperty({ type: 'integer', description: '1-based page number', example: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', description: 'Ratings per page', example: 20 })
  limit!: number;

  @ApiProperty({ type: 'integer', description: 'Total number of pages', example: 3 })
  totalPages!: number;

  @ApiProperty({ description: 'Whether a next page exists', example: true })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Whether a previous page exists', example: false })
  hasPreviousPage!: boolean;
}

/** GET /dashboard/people/employees/:id/ratings (`listEmployeeRatings.execute`). */
export class EmployeeRatingsResponseDto {
  @ApiProperty({ type: [EmployeeRatingRecordDto], description: 'Ratings on the requested page' })
  items!: EmployeeRatingRecordDto[];

  @ApiProperty({ type: EmployeeRatingListMetaDto, description: 'Pagination metadata' })
  meta!: EmployeeRatingListMetaDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'Score counts (1–5) across every rating for this employee',
    example: { 1: 0, 2: 1, 3: 2, 4: 4, 5: 9 },
  })
  starCounts!: Record<number, number>;
}

// ── Write responses ─────────────────────────────────────────────────────────

/** A raw `EmployeeBranch` row. */
export class EmployeeBranchRecordDto {
  @ApiProperty({ description: 'Employee branch link UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000090' })
  id!: string;

  @ApiProperty({ description: 'Employee UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  employeeId!: string;

  @ApiProperty({ description: 'Branch UUID', format: 'uuid', example: '00000000-0000-4000-a000-0000000000a0' })
  branchId!: string;
}

/**
 * Response of create, update and onboarding-step endpoints: the raw Prisma
 * `Employee` row with its `branches` and `services` links. Unlike the read
 * projection this carries no aggregated rating/booking counters, no
 * `branchIds`/`serviceIds` arrays and no `isAcceptingBookings`.
 */
export class EmployeeWriteResponseDto {
  @ApiProperty({ description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential employee reference', example: 1024 })
  ref!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Linked user UUID', example: null })
  userId!: string | null;

  @ApiProperty({ description: 'Full display name', example: 'Dr. Khalid Al-Otaibi' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English name', example: 'Khalid Al-Otaibi' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic name', example: 'خالد العتيبي' })
  nameAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Job title', example: 'Senior Therapist' })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Specialty label (English)', example: 'Family Therapy' })
  specialty!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Specialty label (Arabic)', example: 'علاج أسري' })
  specialtyAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Phone number', example: '+966501234567' })
  phone!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Email address', example: 'khalid@example.com' })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Gender', enum: ['MALE', 'FEMALE'], example: 'MALE' })
  gender!: EmployeeGender | null;

  @ApiProperty({ type: String, nullable: true, description: 'Stored avatar reference', example: null })
  avatarUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Short biography (English)', example: null })
  bio!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Short biography (Arabic)', example: null })
  bioAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Education details (English)', example: null })
  education!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Education details (Arabic)', example: null })
  educationAr!: string | null;

  @ApiProperty({ description: 'Spoken languages', type: [String], example: ['العربية', 'English'] })
  languages!: string[];

  @ApiProperty({ type: 'integer', nullable: true, description: 'Years of experience', example: 8 })
  experience!: number | null;

  @ApiProperty({ description: 'Employment type', enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT'], example: 'FULL_TIME' })
  employmentType!: EmploymentType;

  @ApiProperty({ description: 'Onboarding status', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], example: 'PENDING' })
  onboardingStatus!: OnboardingStatus;

  @ApiProperty({ description: 'Whether the employee is active', example: true })
  isActive!: boolean;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Commission rate (0–1), decimal string', example: '1.0000' })
  commissionRate!: Prisma.Decimal;

  @ApiProperty({ type: String, nullable: true, description: 'Public directory slug', example: null })
  slug!: string | null;

  @ApiProperty({ description: 'Whether the employee is published in the directory', example: false })
  isPublic!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Public biography (Arabic)', example: null })
  publicBioAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Public biography (English)', example: null })
  publicBioEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Stored public portrait reference', example: null })
  publicImageUrl!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: [EmployeeBranchRecordDto], description: 'Assigned branches' })
  branches!: EmployeeBranchRecordDto[];

  @ApiProperty({ type: [EmployeeServiceRecordDto], description: 'Assigned service links' })
  services!: EmployeeServiceRecordDto[];
}

/** POST /dashboard/people/employees/onboarding (`onboardEmployee.execute`). */
export class EmployeeOnboardResponseDto {
  @ApiProperty({ description: 'Always true', example: true })
  success!: boolean;

  @ApiProperty({ description: 'Human-readable result message', example: 'Employee onboarded successfully' })
  message!: string;

  @ApiProperty({ type: EmployeeWriteResponseDto, description: 'The created employee with its links' })
  employee!: EmployeeWriteResponseDto;
}

/** GET /dashboard/people/employees/:id (`getEmployee.execute`). */
export class EmployeeDetailResponseDto extends EmployeeResponseDto {
  @ApiProperty({ type: [EmployeeAvailabilityExceptionRecordDto], description: 'Date-range availability exceptions' })
  exceptions!: EmployeeAvailabilityExceptionRecordDto[];
}
