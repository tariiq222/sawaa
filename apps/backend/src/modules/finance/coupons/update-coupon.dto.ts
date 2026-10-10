import { IsString, IsIn, IsNumber, IsOptional, IsBoolean, IsInt, IsDateString, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCouponDto {
  @ApiPropertyOptional({ description: 'Coupon description in Arabic', example: 'خصم الترحيب' })
  @IsOptional() @IsString() descriptionAr?: string;

  @ApiPropertyOptional({ description: 'Coupon description in English', example: 'Welcome discount' })
  @IsOptional() @IsString() descriptionEn?: string;

  @ApiPropertyOptional({ description: 'Discount value (percent 0–100 or flat amount)', example: 15 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) @Max(100_000_000) discountValue?: number;

  @ApiPropertyOptional({ description: 'Discount calculation type', enum: ['PERCENTAGE', 'FIXED'], example: 'PERCENTAGE' })
  @IsOptional() @IsIn(['PERCENTAGE', 'FIXED']) discountType?: 'PERCENTAGE' | 'FIXED';

  @ApiPropertyOptional({ description: 'Minimum order amount required to use this coupon; null clears limit', type: Number, nullable: true, example: 50.00 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minOrderAmt?: number | null;

  @ApiPropertyOptional({ description: 'Maximum number of total redemptions allowed; null clears limit', type: Number, nullable: true, example: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxUses?: number | null;

  @ApiPropertyOptional({ description: 'Maximum redemptions per individual user; null clears limit', type: Number, nullable: true, example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxUsesPerUser?: number | null;

  @ApiPropertyOptional({ description: 'Restrict coupon to specific service UUIDs', example: ['00000000-0000-0000-0000-000000000000'] })
  @IsOptional() @IsArray() @IsString({ each: true }) serviceIds?: string[];

  @ApiPropertyOptional({ description: 'ISO datetime when the coupon expires; null clears expiry', type: String, format: 'date-time', nullable: true, example: '2026-12-31T23:59:59.000Z' })
  @IsOptional() @IsDateString() expiresAt?: string | null;

  @ApiPropertyOptional({ description: 'Whether the coupon is active and redeemable', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
