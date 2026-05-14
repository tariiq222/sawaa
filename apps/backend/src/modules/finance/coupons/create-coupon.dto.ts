import { IsString, IsIn, IsNumber, IsOptional, IsBoolean, IsInt, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCouponDto {
  @ApiProperty({ description: 'Unique coupon code', example: 'WELCOME10' })
  @IsString() code!: string;

  @ApiPropertyOptional({ description: 'Coupon description in Arabic', example: 'خصم الترحيب' })
  @IsOptional() @IsString() descriptionAr?: string;

  @ApiPropertyOptional({ description: 'Coupon description in English', example: 'Welcome discount' })
  @IsOptional() @IsString() descriptionEn?: string;

  @ApiProperty({ description: 'Discount calculation type', enum: ['PERCENTAGE', 'FIXED'], example: 'PERCENTAGE' })
  @IsIn(['PERCENTAGE', 'FIXED']) discountType!: 'PERCENTAGE' | 'FIXED';

  @ApiProperty({ description: 'Discount value (percent 0–100 or flat amount)', example: 10 })
  @Type(() => Number) @IsNumber() discountValue!: number;

  @ApiPropertyOptional({ description: 'Minimum order amount required to use this coupon', example: 50.00 })
  @IsOptional() @Type(() => Number) @IsNumber() minOrderAmt?: number;

  @ApiPropertyOptional({ description: 'Maximum number of total redemptions allowed', example: 100 })
  @IsOptional() @Type(() => Number) @IsInt() maxUses?: number;

  @ApiPropertyOptional({ description: 'Maximum redemptions per individual user', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() maxUsesPerUser?: number;

  @ApiPropertyOptional({ description: 'Restrict coupon to specific service UUIDs', example: ['00000000-0000-0000-0000-000000000000'] })
  @IsOptional() @IsArray() @IsString({ each: true }) serviceIds?: string[];

  @ApiPropertyOptional({ description: 'ISO datetime when the coupon expires', example: '2026-12-31T23:59:59.000Z' })
  @IsOptional() @IsDateString() expiresAt?: string;

  @ApiPropertyOptional({ description: 'Whether the coupon is active and redeemable', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
