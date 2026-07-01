import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DiscountType, PackageConstraintDimension, PackageConstraintMode } from '@prisma/client';

/**
 * One eligibility constraint on a package item. `mode = ANY` needs no targets;
 * INCLUDE/EXCLUDE list the allowed/blocked target IDs for that dimension
 * (service IDs, employee IDs, duration-option IDs, or delivery-type values).
 */
export class PackageConstraintInputDto {
  @ApiProperty({ description: 'Constraint dimension', enum: PackageConstraintDimension, example: PackageConstraintDimension.PRACTITIONER })
  @IsEnum(PackageConstraintDimension)
  dimension!: PackageConstraintDimension;

  @ApiProperty({ description: 'Matching mode', enum: PackageConstraintMode, example: PackageConstraintMode.ANY })
  @IsEnum(PackageConstraintMode)
  mode!: PackageConstraintMode;

  @ApiPropertyOptional({ description: 'Target IDs for INCLUDE/EXCLUDE. Empty/omitted for ANY.', type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  targetIds?: string[];
}

export class CreateSessionPackageItemDto {
  @ApiPropertyOptional({ description: 'Legacy single-service UUID. Omit for flexible items (use constraints).', format: 'uuid', example: '00000000-0000-4000-a000-000000000000' })
  @IsOptional() @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Legacy single-practitioner UUID. Omit for flexible items (use constraints).', format: 'uuid', example: '00000000-0000-4000-a000-000000000000' })
  @IsOptional() @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Legacy single ServiceDurationOption UUID. Omit for flexible items (use constraints).', format: 'uuid', example: '00000000-0000-4000-a000-000000000000' })
  @IsOptional() @IsUUID()
  durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Eligibility constraints (multi-dimensional). Preferred over the legacy triple.', type: [PackageConstraintInputDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PackageConstraintInputDto)
  constraints?: PackageConstraintInputDto[];

  @ApiPropertyOptional({ description: 'Fixed prepaid unit price in integer halalas. Required for flexible (non single-specific) items.', minimum: 0, example: 20000 })
  @IsOptional() @IsInt() @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Optional display label for the item', maxLength: 200, example: 'استشارة فردية — أي معالج' })
  @IsOptional() @IsString() @MaxLength(200)
  label?: string;

  @ApiProperty({ description: 'Number of paid sessions the client gets', minimum: 0, example: 4 })
  @IsInt() @Min(0)
  paidQuantity!: number;

  @ApiPropertyOptional({ description: 'Number of free bonus sessions bundled with the paid ones', minimum: 0, default: 0, example: 1 })
  @IsOptional() @IsInt() @Min(0)
  freeQuantity?: number;

  @ApiPropertyOptional({ description: 'Per-item discount type applied to (paid × unit price). Omit/null for no discount.', enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsOptional() @IsEnum(DiscountType)
  discountType?: DiscountType | null;

  @ApiPropertyOptional({ description: 'Per-item discount value. PERCENTAGE: 0-100. FIXED: integer halalas.', minimum: 0, default: 0, example: 10 })
  @IsOptional() @IsInt() @Min(0)
  discountValue?: number;

  @ApiPropertyOptional({ description: 'Display order within the package', minimum: 0, example: 0 })
  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

/**
 * Class-level rule (every item must offer at least one session —
 * paidQuantity + freeQuantity >= 1) is intentionally enforced in the
 * Create/Update handlers instead of via @Validate() on a placeholder
 * field. class-validator's @Validate(ConstraintClass) with a plain class
 * is silently dead in this version (see create-invoice.dto.spec.ts note
 * for the precedent). The handler-level check is authoritative and is
 * covered by the create / update handler specs.
 */
export class CreateSessionPackageDto {
  @ApiProperty({ description: 'Arabic name', maxLength: 200, example: 'باقة الاستشارة العائلية' })
  @IsString() @MaxLength(200)
  nameAr!: string;

  @ApiPropertyOptional({ description: 'English name', maxLength: 200, example: 'Family Counseling Pack' })
  @IsOptional() @IsString() @MaxLength(200)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Arabic description', example: 'أربع جلسات استشارة مع المعالج' })
  @IsOptional() @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'English description', example: 'Four consultation sessions with the practitioner' })
  @IsOptional() @IsString()
  descriptionEn?: string;

  @ApiPropertyOptional({ description: 'Image URL (upload via /uploads)', example: 'https://cdn.example.com/pack.png' })
  @IsOptional() @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Lucide icon name', example: 'package' })
  @IsOptional() @IsString()
  iconName?: string;

  @ApiPropertyOptional({ description: 'Icon background color (hex)', example: '#FFD8A8' })
  @IsOptional() @IsString()
  iconBgColor?: string;

  /**
   * DEPRECATED package-level discount — superseded by per-item discount on
   * each `items[]` entry. Kept optional for backward compatibility; the
   * handler ignores it and stores a neutral PERCENTAGE/0 on the package.
   */
  @ApiPropertyOptional({ description: 'DEPRECATED — use per-item discount. Ignored.', enum: DiscountType })
  @IsOptional() @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiPropertyOptional({ description: 'DEPRECATED — use per-item discount. Ignored.', minimum: 0 })
  @IsOptional() @IsInt() @Min(0)
  discountValue?: number;

  @ApiPropertyOptional({ description: 'Whether the package is selectable', default: true, example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether the package is visible to clients on the public catalog', default: false, example: true })
  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Display order (ascending)', minimum: 0, default: 0, example: 0 })
  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @ApiProperty({ description: 'Package items (min 1)', type: [CreateSessionPackageItemDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => CreateSessionPackageItemDto)
  items!: CreateSessionPackageItemDto[];
}