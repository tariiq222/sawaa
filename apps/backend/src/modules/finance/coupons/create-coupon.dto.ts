import { IsString, IsIn, IsNumber, IsOptional, IsBoolean, IsInt, IsDateString, IsArray, Min, Max, ArrayMaxSize, IsUUID, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCouponDto {
  @ApiProperty({ description: 'Unique coupon code', example: 'WELCOME10' })
  @IsString() @MaxLength(64) code!: string;

  @ApiPropertyOptional({ description: 'Coupon description in Arabic', example: 'خصم الترحيب' })
  @IsOptional() @IsString() @MaxLength(500) descriptionAr?: string;

  @ApiPropertyOptional({ description: 'Coupon description in English', example: 'Welcome discount' })
  @IsOptional() @IsString() @MaxLength(500) descriptionEn?: string;

  @ApiProperty({ description: 'Discount calculation type', enum: ['PERCENTAGE', 'FIXED'], example: 'PERCENTAGE' })
  @IsIn(['PERCENTAGE', 'FIXED']) discountType!: 'PERCENTAGE' | 'FIXED';

  // SECURITY (P1): without bounds a negative value used to flip the coupon
  // into a surcharge (raising the invoice total). Cap PERCENTAGE at 100 too;
  // FIXED can be any positive halalas but never negative.
  @ApiProperty({ description: 'Discount value (percent 0–100 or flat amount, ≥ 0)', example: 10 })
  @Type(() => Number) @IsNumber() @Min(0) @Max(100_000_000) discountValue!: number;

  @ApiPropertyOptional({ description: 'Minimum order amount required to use this coupon', example: 50.00 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minOrderAmt?: number;

  @ApiPropertyOptional({ description: 'Maximum number of total redemptions allowed', example: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxUses?: number;

  @ApiPropertyOptional({ description: 'Maximum redemptions per individual user', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxUsesPerUser?: number;

  @ApiPropertyOptional({ description: 'Restrict coupon to specific service UUIDs', example: ['00000000-0000-0000-0000-000000000000'] })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) serviceIds?: string[];

  @ApiPropertyOptional({ description: 'ISO datetime when the coupon expires', example: '2026-12-31T23:59:59.000Z' })
  @IsOptional() @IsDateString() expiresAt?: string;

  @ApiPropertyOptional({ description: 'Whether the coupon is active and redeemable', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
