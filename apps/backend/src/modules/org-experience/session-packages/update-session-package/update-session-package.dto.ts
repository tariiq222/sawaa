import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { DiscountType } from '@prisma/client';
import { CreateSessionPackageItemDto } from '../create-session-package/create-session-package.dto';

/**
 * Every field is optional. Items may be omitted (no replacement) or
 * provided as a full replacement set (delete-and-create semantics in the
 * handler so sortOrder / quantity changes stay atomic).
 */
export class UpdateSessionPackageDto {
  @ApiPropertyOptional({ description: 'Arabic name', maxLength: 200, example: 'باقة محدّثة' })
  @IsOptional() @IsString() @MaxLength(200)
  nameAr?: string;

  @ApiPropertyOptional({ description: 'English name', maxLength: 200, example: 'Updated Pack' })
  @IsOptional() @IsString() @MaxLength(200)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Arabic description' })
  @IsOptional() @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'English description' })
  @IsOptional() @IsString()
  descriptionEn?: string;

  @ApiPropertyOptional({ description: 'Image URL' })
  @IsOptional() @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Lucide icon name' })
  @IsOptional() @IsString()
  iconName?: string;

  @ApiPropertyOptional({ description: 'Icon background color (hex)' })
  @IsOptional() @IsString()
  iconBgColor?: string;

  @ApiPropertyOptional({ description: 'Discount type — PERCENTAGE (0-100) or FIXED (integer halalas, 1 SAR = 100)', enum: DiscountType })
  @IsOptional() @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiPropertyOptional({ description: 'Discount value (see CreateSessionPackageDto for semantics)', minimum: 0 })
  @IsOptional() @IsInt() @Min(0)
  discountValue?: number;

  @ApiPropertyOptional({ description: 'Whether the package is selectable', example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether the package is visible to clients', example: true })
  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Display order (ascending)', minimum: 0 })
  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Replacement items (full set; delete-and-create semantics in the handler)',
    type: [CreateSessionPackageItemDto],
  })
  @IsOptional() @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => CreateSessionPackageItemDto)
  items?: CreateSessionPackageItemDto[];

  // Carried by the controller from the path param; exposed here so the handler
  // can accept `UpdateSessionPackageDto & { packageId: string }` directly.
  @IsOptional() @IsUUID()
  packageId?: string;
}