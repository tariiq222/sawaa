import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { CategoryBookingMode, CategoryKind } from '@prisma/client';

/**
 * Swagger response shapes for GET /public/services.
 *
 * Documentation-only DTOs that mirror exactly what PublicCatalogController.getCatalog
 * returns (the Prisma rows/projections plus the read-time image signing and the
 * `showPrice`/`showDuration` flags). They do not change the runtime payload.
 *
 * `departments` and `categories` are read with a bare `findMany` (no `select`),
 * so the response carries every scalar column of those tables — including
 * `isActive`, `iconName`, `iconBgColor`, `departmentId`, `ref` and both
 * timestamps. The DTOs below document those columns; omitting them was a
 * documentation gap, never a runtime guarantee.
 */

const ISO_EXAMPLE = '2026-01-01T00:00:00.000Z';

/** One `Department` row (`prisma.department.findMany` without a select). */
export class CatalogDepartmentDto {
  @ApiProperty({ format: 'uuid', description: 'Department UUID', example: '00000000-0000-4000-a000-000000000010' })
  id!: string;

  @ApiProperty({ description: 'Arabic department name', example: 'الاستشارات الأسرية' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English department name, or null', example: 'Family Counseling' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic description, or null', example: null })
  descriptionAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English description, or null', example: null })
  descriptionEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Icon identifier, or null', example: 'HeartHandshake' })
  icon!: string | null;

  @ApiProperty({ description: 'Whether the department header is shown; false means its categories render at the root', example: true })
  isVisible!: boolean;

  @ApiProperty({ type: 'integer', description: 'Display order', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Whether the department is active', example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** One `ServiceCategory` row with its image signed at read time. */
export class CatalogCategoryDto {
  @ApiProperty({ format: 'uuid', description: 'Category UUID', example: '00000000-0000-4000-a000-000000000020' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Human-facing sequential category reference', example: 1024 })
  ref!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Owning department UUID, or null when the category sits at the root', example: '00000000-0000-4000-a000-000000000010' })
  departmentId!: string | null;

  @ApiProperty({ description: 'Arabic category name', example: 'استشارات' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English category name, or null', example: 'Consultations' })
  nameEn!: string | null;

  @ApiProperty({ type: 'integer', description: 'Display order', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Whether the category is active', example: true })
  isActive!: boolean;

  @ApiProperty({ enum: ['DIRECT', 'SERVICES'], description: 'Whether booking starts at the clinic or with a service selection', example: 'SERVICES' })
  bookingMode!: CategoryBookingMode;

  @ApiProperty({ enum: ['CLINIC', 'SERVICE_GROUP'], description: 'Category kind, independent of department and name', example: 'CLINIC' })
  kind!: CategoryKind;

  @ApiProperty({ type: String, nullable: true, description: 'Short-lived presigned image URL (signed per response), or null', example: 'https://media.example.com/cat.png?sig=abc' })
  imageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Lucide icon name, or null', example: 'HeartHandshake' })
  iconName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Icon background colour (hex), or null', example: '#2FA694' })
  iconBgColor!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** One service-level duration option (`ServiceDurationOption` projection). */
export class CatalogServiceDurationOptionDto {
  @ApiProperty({ format: 'uuid', description: 'Duration-option UUID', example: '00000000-0000-4000-a000-000000000031' })
  id!: string;

  @ApiProperty({ description: 'Localized option label (`ServiceDurationOption.label`, non-null in the schema)', example: '45 دقيقة' })
  label!: string;

  @ApiProperty({ type: 'integer', description: 'Duration in minutes', example: 45 })
  durationMins!: number;

  @ApiProperty({ type: String, description: 'Price in integer halalas (Prisma Decimal serialized as string)', example: '15000' })
  price!: Prisma.Decimal;

  @ApiProperty({ type: 'integer', description: 'Display order', example: 0 })
  sortOrder!: number;
}

/** One active per-delivery-type booking config of a service. */
export class CatalogServiceBookingConfigDto {
  @ApiProperty({ format: 'uuid', description: 'Booking-config UUID', example: '00000000-0000-4000-a000-000000000041' })
  id!: string;

  @ApiProperty({ enum: ['IN_PERSON', 'ONLINE'], description: 'Delivery channel', example: 'IN_PERSON' })
  deliveryType!: 'IN_PERSON' | 'ONLINE';

  @ApiProperty({ type: String, description: 'Price in integer halalas (Prisma Decimal serialized as string)', example: '15000' })
  price!: Prisma.Decimal;

  @ApiProperty({ type: 'integer', description: 'Default duration in minutes for this channel', example: 45 })
  durationMins!: number;
}

/**
 * One service row. `isHidden` is present only when the caller asks for
 * `includeDirectClinics=true`; without the flag the internal direct-clinic
 * services are filtered out and the key is omitted.
 */
export class CatalogServiceDto {
  @ApiProperty({ format: 'uuid', description: 'Service UUID', example: '00000000-0000-4000-a000-000000000030' })
  id!: string;

  @ApiPropertyOptional({ description: 'Present for includeDirectClinics; internal direct-clinic services are not listed as standalone services', example: false })
  isHidden?: boolean;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Owning service category UUID, or null for an uncategorized service', example: '00000000-0000-4000-a000-000000000020' })
  categoryId!: string | null;

  @ApiProperty({ description: 'Arabic service name', example: 'جلسة استشارة فردية' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English service name, or null', example: 'Individual Counseling Session' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic description, or null', example: null })
  descriptionAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English description, or null', example: null })
  descriptionEn!: string | null;

  @ApiProperty({ type: 'integer', description: 'Default session duration in minutes', example: 45 })
  durationMins!: number;

  @ApiProperty({ type: String, description: 'Price in integer halalas (Prisma Decimal serialized as string)', example: '15000' })
  price!: Prisma.Decimal;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Short-lived presigned image URL (signed per response), or null', example: null })
  imageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Lucide icon name, or null', example: null })
  iconName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Icon background colour (hex), or null', example: null })
  iconBgColor!: string | null;

  @ApiProperty({ description: 'Whether to display the price on the booking surface (inverse of hidePriceOnBooking)', example: true })
  showPrice!: boolean;

  @ApiProperty({ description: 'Whether to display the duration on the booking surface (inverse of hideDurationOnBooking)', example: true })
  showDuration!: boolean;

  @ApiProperty({ type: [CatalogServiceDurationOptionDto], description: 'Service-level duration options (practitioner-owned rows excluded)' })
  durationOptions!: CatalogServiceDurationOptionDto[];

  @ApiProperty({ type: [CatalogServiceBookingConfigDto], description: 'Active per-delivery-type booking configs', example: [] })
  bookingConfigs!: CatalogServiceBookingConfigDto[];
}

export class PublicCatalogDto {
  @ApiProperty({ type: [CatalogDepartmentDto], description: 'Active, visible departments ordered by sortOrder', example: [] })
  departments!: CatalogDepartmentDto[];

  @ApiProperty({ type: [CatalogCategoryDto], description: 'Active categories ordered by sortOrder', example: [] })
  categories!: CatalogCategoryDto[];

  @ApiProperty({ type: [CatalogServiceDto], description: 'Active services; internal direct-clinic services only with includeDirectClinics=true', example: [] })
  services!: CatalogServiceDto[];

  @ApiProperty({
    example: 0,
    description: 'VAT rate as a fraction of 1 from organization settings; 0 when the center is not VAT-registered or settings are missing',
  })
  vatRate!: number;
}
