import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';

export class UpdateBundleDto {
  // ─── الأساسيات ───────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'باقة العناية الشاملة' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @ApiPropertyOptional({ example: 'Full Care Bundle' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Bundle description in Arabic' })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'Bundle description in English' })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiPropertyOptional({ description: 'Bundle image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  // ─── الهوية البصرية ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'bundle-01' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  iconName?: string;

  @ApiPropertyOptional({ example: '#F0F4FF' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  iconBgColor?: string;

  // ─── السعر والخصم ────────────────────────────────────────────────────────
  @ApiPropertyOptional({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiPropertyOptional({ example: 10, description: 'Discount value (percentage or fixed amount)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiPropertyOptional({ example: 'SAR' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  // ─── العرض/الإخفاء ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  // ─── الخدمات ─────────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    description: 'Replace bundle services. Must include at least 2 services. Order defines execution order.',
    type: [String],
    format: 'uuid',
    minItems: 2,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(2)
  serviceIds?: string[];
}
