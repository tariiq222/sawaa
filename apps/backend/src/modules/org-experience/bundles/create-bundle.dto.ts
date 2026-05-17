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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';

export class CreateBundleDto {
  // ─── الأساسيات ───────────────────────────────────────────────────────────
  @ApiProperty({ example: 'باقة العناية الشاملة' })
  @IsString()
  @MaxLength(200)
  nameAr!: string;

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
  @ApiProperty({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @ApiProperty({ example: 10, description: 'Discount value (percentage or fixed amount)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @ApiPropertyOptional({ example: 'SAR', default: 'SAR' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  // ─── العرض/الإخفاء ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  // ─── الخدمات ─────────────────────────────────────────────────────────────
  @ApiProperty({
    description: 'Array of service UUIDs to include in the bundle. Order defines execution order.',
    type: [String],
    format: 'uuid',
    minItems: 2,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(2)
  serviceIds!: string[];
}
