import { ApiProperty } from '@nestjs/swagger';
import { CategoryBookingMode, CategoryKind, DeliveryType, Prisma } from '@prisma/client';
import {
  ServiceDurationOptionRecordDto,
  ServiceRecordDto,
  EmployeeEffectiveDurationGroupDto,
} from './employee-response.dto';
import { ListMetaDto } from './people-response.dto';

/**
 * Response shapes of the dashboard service endpoints
 * (`organization-services.controller.ts`).
 *
 * These classes only document what the handlers return. They are never
 * instantiated and no interceptor rewrites the payload, so they cannot change a
 * response. Every property is traced to a handler, its Prisma include/select or
 * its mapper; `service-response.dto.spec.ts` asserts each handler result is
 * exactly its DTO.
 */

const ISO_DATE_TIME = { type: String, format: 'date-time' } as const;
const DECIMAL_STRING = { type: String } as const;
const UUID_EXAMPLE = '00000000-0000-4000-a000-000000000001';

// ── Category embedded in a service payload ─────────────────────────────────

/**
 * A raw `ServiceCategory` row embedded in a service payload
 * (`include: { category: true }`).
 */
export class ServiceEmbeddedCategoryDto {
  @ApiProperty({ description: 'Category UUID', format: 'uuid', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential category reference', example: 101 })
  ref!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Owning department UUID', example: null })
  departmentId!: string | null;

  @ApiProperty({ description: 'Arabic category name', example: 'الإرشاد الأسري' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English category name', example: 'Family Guidance' })
  nameEn!: string | null;

  @ApiProperty({ type: 'integer', description: 'Category display order', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Whether the category is active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Category booking mode', enum: CategoryBookingMode, example: CategoryBookingMode.SERVICES })
  bookingMode!: CategoryBookingMode;

  @ApiProperty({ description: 'Category kind, independent of department and name', enum: CategoryKind, example: CategoryKind.CLINIC })
  kind!: CategoryKind;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Category image; signed into a short-lived URL by the list/detail/create/update paths',
    example: null,
  })
  imageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Category icon name', example: 'family' })
  iconName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Category icon background colour', example: '#F0F4FF' })
  iconBgColor!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

/** A raw `Department` row; the list payload includes the whole row. */
export class ServiceCategoryDepartmentRecordDto {
  @ApiProperty({ description: 'Department UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000002' })
  id!: string;

  @ApiProperty({ description: 'Arabic department name', example: 'قسم الاستشارات الأسرية' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English department name', example: 'Family Counseling' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic department description', example: null })
  descriptionAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English department description', example: null })
  descriptionEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Department icon identifier', example: 'family' })
  icon!: string | null;

  @ApiProperty({ description: 'Whether the department is shown in public navigation', example: true })
  isVisible!: boolean;

  @ApiProperty({ type: 'integer', description: 'Department display order', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Whether the department is active', example: true })
  isActive!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

/** The embedded category on a list item; the list includes its department. */
export class ServiceEmbeddedCategoryListItemDto extends ServiceEmbeddedCategoryDto {
  @ApiProperty({ type: ServiceCategoryDepartmentRecordDto, nullable: true, description: 'Owning department row' })
  department!: ServiceCategoryDepartmentRecordDto | null;
}

// ── Service payloads ────────────────────────────────────────────────────────

/**
 * GET/POST/PATCH `/dashboard/organization/services[/:serviceId]` and
 * POST `/services/:serviceId/restore` return the raw `Service` row with its
 * category and duration options.
 */
export class ServiceDetailResponseDto extends ServiceRecordDto {
  @ApiProperty({ type: ServiceEmbeddedCategoryDto, nullable: true, description: 'Owning category row' })
  category!: ServiceEmbeddedCategoryDto | null;

  @ApiProperty({ type: [ServiceDurationOptionRecordDto], description: 'Service-level duration options ordered by sortOrder' })
  durationOptions!: ServiceDurationOptionRecordDto[];
}

/**
 * POST `/services/:serviceId/restore` persists the raw image reference and does
 * not sign it, so its `imageUrl` and the embedded category image are stored
 * values rather than presigned URLs.
 */
export class ServiceRestoreResponseDto extends ServiceDetailResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Persisted image reference returned without signing; may be a storage key or a legacy external URL',
    example: null,
  })
  declare imageUrl: string | null;

  @ApiProperty({ type: ServiceEmbeddedCategoryDto, nullable: true, description: 'Owning category row (image reference not signed)' })
  declare category: ServiceEmbeddedCategoryDto | null;
}

/** One row of GET `/dashboard/organization/services`. */
export class ServiceListItemResponseDto extends ServiceDetailResponseDto {
  @ApiProperty({ type: ServiceEmbeddedCategoryListItemDto, nullable: true, description: 'Owning category row with its department' })
  declare category: ServiceEmbeddedCategoryListItemDto | null;

  @ApiProperty({
    type: 'integer',
    description: 'Active employees offering this service; 0 means the booking wizard disables it',
    example: 2,
  })
  employeeCount!: number;
}

/** GET `/dashboard/organization/services`. */
export class PaginatedServicesResponseDto {
  @ApiProperty({ type: [ServiceListItemResponseDto], description: 'Services on the requested page' })
  items!: ServiceListItemResponseDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata for the full result set' })
  meta!: ListMetaDto;
}

// ── Booking types (delivery-type configs) ──────────────────────────────────

/** A raw `ServiceBookingConfig` row. */
export class ServiceBookingConfigRecordDto {
  @ApiProperty({ description: 'Booking config UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000070' })
  id!: string;

  @ApiProperty({ description: 'Service UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000030' })
  serviceId!: string;

  @ApiProperty({ description: 'Delivery type', enum: ['IN_PERSON', 'ONLINE'], example: 'IN_PERSON' })
  deliveryType!: DeliveryType;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Price in halalas, decimal string', example: '30000' })
  price!: Prisma.Decimal;

  @ApiProperty({ type: 'integer', description: 'Default duration in minutes for this delivery type', example: 60 })
  durationMins!: number;

  @ApiProperty({ description: 'Whether this delivery type is bookable', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Whether the service uses its own availability windows for this delivery type', example: false })
  useCustomAvailability!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

/** A raw `ServiceAvailabilityWindow` row. */
export class ServiceAvailabilityWindowRecordDto {
  @ApiProperty({ description: 'Availability window UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000080' })
  id!: string;

  @ApiProperty({ description: 'Service UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000030' })
  serviceId!: string;

  @ApiProperty({ description: 'Delivery type', enum: ['IN_PERSON', 'ONLINE'], example: 'IN_PERSON' })
  deliveryType!: DeliveryType;

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

/** GET and PUT `/dashboard/organization/services/:serviceId/booking-types`. */
export class ServiceBookingConfigResponseDto extends ServiceBookingConfigRecordDto {
  @ApiProperty({ type: [ServiceDurationOptionRecordDto], description: 'Duration options scoped to this delivery type' })
  durationOptions!: ServiceDurationOptionRecordDto[];

  @ApiProperty({ type: [ServiceAvailabilityWindowRecordDto], description: 'Custom availability windows scoped to this delivery type' })
  availabilityWindows!: ServiceAvailabilityWindowRecordDto[];
}

// ── Service employees ──────────────────────────────────────────────────────

/** Synthetic name split attached to a practitioner in the service-employees list. */
export class ServiceEmployeeUserNameDto {
  @ApiProperty({ description: 'First part of the display name', example: 'Sara' })
  firstName!: string;

  @ApiProperty({ description: 'Remaining display-name parts', example: 'Al-Harbi' })
  lastName!: string;
}

/** The employee embedded in a service-employees row. */
export class ServiceEmployeePractitionerDto {
  @ApiProperty({ description: 'Employee UUID', format: 'uuid', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Employee name (Arabic)', example: 'سارة الحربي' })
  nameAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Professional title', example: 'Family counselor' })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Signed portrait URL, or null when the employee has no portrait', example: null })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Whether the employee is active', example: true })
  isActive!: boolean;

  @ApiProperty({ type: [String], description: 'Branches the employee works at', example: [] })
  branchIds!: string[];

  @ApiProperty({ type: ServiceEmployeeUserNameDto, description: 'Display name split into first and last parts' })
  user!: ServiceEmployeeUserNameDto;
}

/** One bookable delivery type for a practitioner on this service. */
export class ServiceEmployeeServiceTypeDto {
  @ApiProperty({ description: 'Synthetic type id (`<employeeServiceId>:<deliveryType>`)', example: 'link-uuid:IN_PERSON' })
  id!: string;

  @ApiProperty({ description: 'Delivery type', enum: ['IN_PERSON', 'ONLINE'], example: 'IN_PERSON' })
  deliveryType!: DeliveryType;

  @ApiProperty({ description: 'Legacy alias of deliveryType (deprecated)', enum: ['IN_PERSON', 'ONLINE'], example: 'IN_PERSON' })
  bookingType!: DeliveryType;

  @ApiProperty({ type: 'integer', description: 'Effective price in halalas', example: 30000 })
  price!: number;

  @ApiProperty({ type: 'integer', description: 'Effective duration in minutes', example: 60 })
  durationMins!: number;

  @ApiProperty({ type: 'integer', description: 'Service-level base price in halalas', example: 25000 })
  basePrice!: number;

  @ApiProperty({ type: 'integer', description: 'Service-level base duration in minutes', example: 50 })
  baseDurationMins!: number;

  @ApiProperty({ description: 'Whether the practitioner has a price or duration override', example: true })
  isCustom!: boolean;

  @ApiProperty({ description: 'Always true for returned entries', example: true })
  isActive!: boolean;
}

/**
 * GET `/dashboard/organization/services/:serviceId/employees` — one active
 * practitioner offering the service.
 */
export class ServiceEmployeeAssignmentDto {
  @ApiProperty({ description: 'EmployeeService link UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000020' })
  id!: string;

  @ApiProperty({ type: ServiceEmployeePractitionerDto, description: 'The practitioner offering the service' })
  employee!: ServiceEmployeePractitionerDto;

  @ApiProperty({ type: [ServiceEmployeeServiceTypeDto], description: 'Bookable delivery types with effective price and duration' })
  serviceTypes!: ServiceEmployeeServiceTypeDto[];

  @ApiProperty({ description: 'Whether any delivery type carries a price or duration override', example: true })
  hasCustomPricing!: boolean;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Deprecated; the handler always emits null', example: null })
  customDuration!: null;

  @ApiProperty({ type: 'integer', description: 'Buffer minutes after a session', example: 10 })
  bufferMinutes!: number;

  @ApiProperty({
    description: 'Delivery types the service offers',
    enum: ['IN_PERSON', 'ONLINE'],
    isArray: true,
    example: ['IN_PERSON', 'ONLINE'],
  })
  availableTypes!: DeliveryType[];

  @ApiProperty({
    description: 'Delivery types this practitioner opts out of for the service',
    enum: ['IN_PERSON', 'ONLINE'],
    isArray: true,
    example: [],
  })
  disabledDeliveryTypes!: DeliveryType[];

  @ApiProperty({ description: 'Whether the practitioner prices this service from owned duration rows', example: false })
  useCustomPricing!: boolean;

  @ApiProperty({ description: 'Whether the assignment is active', example: true })
  isActive!: boolean;

  @ApiProperty({ type: [EmployeeEffectiveDurationGroupDto], description: 'Effective durations grouped by delivery type' })
  effectiveDurations!: EmployeeEffectiveDurationGroupDto[];
}
