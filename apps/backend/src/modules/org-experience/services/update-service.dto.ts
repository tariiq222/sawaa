import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeText } from './sanitize-text.decorator';

export class UpdateServiceDto {
  // ─── الأساسيات ───────────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Service name in Arabic', example: 'قص الشعر' })
  @SanitizeText() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) nameAr?: string;

  @ApiPropertyOptional({ description: 'Service name in English', example: 'Haircut' })
  @SanitizeText() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'Description in Arabic' })
  @SanitizeText() @IsOptional() @IsString() descriptionAr?: string;

  @ApiPropertyOptional({ description: 'Description in English' })
  @SanitizeText() @IsOptional() @IsString() descriptionEn?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes', example: 30 })
  @IsOptional() @IsInt() @Min(1) durationMins?: number;

  @ApiPropertyOptional({ description: 'Price in integer halalas (1 SAR = 100)', example: 5000 })
  @IsOptional() @IsInt() @Min(0) price?: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'SAR' })
  @IsOptional() @IsString() @MaxLength(8) currency?: string;

  @ApiPropertyOptional({ description: 'Service image URL', example: 'https://example.com/logo.png' })
  @IsOptional() @IsString() imageUrl?: string;

  @ApiPropertyOptional({ description: 'Category UUID', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional() @IsUUID() categoryId?: string;

  // ─── العرض/الإخفاء ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Whether the service is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether the service is hidden from clients', example: false })
  @IsOptional() @IsBoolean() isHidden?: boolean;

  @ApiPropertyOptional({ description: 'Hide price during booking flow', example: false })
  @IsOptional() @IsBoolean() hidePriceOnBooking?: boolean;

  @ApiPropertyOptional({ description: 'Hide duration during booking flow', example: false })
  @IsOptional() @IsBoolean() hideDurationOnBooking?: boolean;

  // ─── الهوية البصرية ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Icon identifier', example: 'scissors-01' })
  @IsOptional() @IsString() @MaxLength(50) iconName?: string;

  @ApiPropertyOptional({ description: 'Icon background color (hex)', example: '#F0F4FF' })
  @IsOptional() @IsString() @MaxLength(20) iconBgColor?: string;

  // ─── قواعد الجدولة ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Buffer time in minutes after the service', example: 10 })
  @IsOptional() @IsInt() @Min(0) bufferMinutes?: number;

  @ApiPropertyOptional({ description: 'Minimum lead time in minutes before booking', example: 60 })
  @IsOptional() @IsInt() @Min(0) minLeadMinutes?: number;

  @ApiPropertyOptional({ description: 'Maximum advance booking in days', example: 30 })
  @IsOptional() @IsInt() @Min(1) maxAdvanceDays?: number;

  // ─── العربون ─────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Whether a deposit is required', example: false })
  @IsOptional() @IsBoolean() depositEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Fixed deposit amount in integer halalas — must not exceed price', example: 2000 })
  @ValidateIf((o: UpdateServiceDto) => o.depositEnabled === true)
  @IsDefined() @IsInt() @Min(1) depositAmount?: number;

  // ─── التزامن المتفائل ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Expected updatedAt timestamp (ISO) for optimistic concurrency; if it does not match current state, the update is rejected with 409', example: '2026-06-08T10:00:00.000Z' })
  @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}
