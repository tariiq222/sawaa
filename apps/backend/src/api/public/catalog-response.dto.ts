import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response shapes for GET /public/services.
 *
 * Documentation-only DTOs that mirror exactly what PublicCatalogController.getCatalog
 * returns (the Prisma `select` projections plus the read-time image signing and the
 * `showPrice`/`showDuration` flags). They do not change the runtime payload.
 */

export class CatalogDepartmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'الاستشارات الأسرية' })
  nameAr!: string;

  @ApiProperty({ nullable: true, example: 'Family Counseling' })
  nameEn!: string | null;

  @ApiProperty({ example: 0, description: 'Display order' })
  sortOrder!: number;
}

export class CatalogCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'استشارات' })
  nameAr!: string;

  @ApiProperty({ nullable: true, example: 'Consultations' })
  nameEn!: string | null;

  @ApiProperty({ nullable: true, description: 'Short-lived presigned image URL (signed per response), or null' })
  imageUrl!: string | null;

  @ApiProperty({ example: 0, description: 'Display order' })
  sortOrder!: number;
}

export class CatalogServiceDurationOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, example: '45 دقيقة' })
  label!: string | null;

  @ApiProperty({ example: 45 })
  durationMins!: number;

  @ApiProperty({ type: 'string', example: '15000', description: 'Price in integer halalas (Prisma Decimal serialized as string)' })
  price!: string;

  @ApiProperty({ example: 0, description: 'Display order' })
  sortOrder!: number;
}

export class CatalogServiceBookingConfigDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['IN_PERSON', 'ONLINE'] })
  deliveryType!: 'IN_PERSON' | 'ONLINE';

  @ApiProperty({ type: 'string', example: '15000', description: 'Price in integer halalas (Prisma Decimal serialized as string)' })
  price!: string;

  @ApiProperty({ example: 45 })
  durationMins!: number;
}

export class CatalogServiceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Owning service category' })
  categoryId!: string;

  @ApiProperty({ example: 'جلسة استشارة فردية' })
  nameAr!: string;

  @ApiProperty({ nullable: true, example: 'Individual Counseling Session' })
  nameEn!: string | null;

  @ApiProperty({ nullable: true })
  descriptionAr!: string | null;

  @ApiProperty({ nullable: true })
  descriptionEn!: string | null;

  @ApiProperty({ example: 45 })
  durationMins!: number;

  @ApiProperty({ type: 'string', example: '15000', description: 'Price in integer halalas (Prisma Decimal serialized as string)' })
  price!: string;

  @ApiProperty({ example: 'SAR' })
  currency!: string;

  @ApiProperty({ nullable: true, description: 'Short-lived presigned image URL (signed per response), or null' })
  imageUrl!: string | null;

  @ApiProperty({ nullable: true })
  iconName!: string | null;

  @ApiProperty({ nullable: true })
  iconBgColor!: string | null;

  @ApiProperty({ description: 'Whether to display the price on the booking surface' })
  showPrice!: boolean;

  @ApiProperty({ description: 'Whether to display the duration on the booking surface' })
  showDuration!: boolean;

  @ApiProperty({ type: [CatalogServiceDurationOptionDto], description: 'Service-level duration options (practitioner-owned rows excluded)' })
  durationOptions!: CatalogServiceDurationOptionDto[];

  @ApiProperty({ type: [CatalogServiceBookingConfigDto], description: 'Active per-delivery-type booking configs' })
  bookingConfigs!: CatalogServiceBookingConfigDto[];
}

export class PublicCatalogDto {
  @ApiProperty({ type: [CatalogDepartmentDto] })
  departments!: CatalogDepartmentDto[];

  @ApiProperty({ type: [CatalogCategoryDto] })
  categories!: CatalogCategoryDto[];

  @ApiProperty({ type: [CatalogServiceDto] })
  services!: CatalogServiceDto[];

  @ApiProperty({
    example: 0,
    description: 'Fractional VAT rate (0.15 = 15%); 0 when the center is not VAT-registered or settings are missing',
  })
  vatRate!: number;
}
