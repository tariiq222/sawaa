import {
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
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecurringPatternDto } from './create-service.dto';

export class UpdateServiceDto {
  // ─── الأساسيات ───────────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Service name in Arabic', example: 'قص الشعر' })
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;

  @ApiPropertyOptional({ description: 'Service name in English', example: 'Haircut' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'Description in Arabic' })
  @IsOptional() @IsString() descriptionAr?: string;

  @ApiPropertyOptional({ description: 'Description in English' })
  @IsOptional() @IsString() descriptionEn?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes', example: 30 })
  @IsOptional() @IsInt() @Min(1) durationMins?: number;

  @ApiPropertyOptional({ description: 'Price', example: 50 })
  @IsOptional() @IsNumber() @Min(0) price?: number;

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

  @ApiPropertyOptional({ description: 'Fixed deposit amount (must not exceed price)', example: 20 })
  @ValidateIf((o: UpdateServiceDto) => o.depositEnabled === true)
  @IsOptional() @IsNumber() @Min(0) depositAmount?: number;

  // ─── التكرار ─────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Whether recurring bookings are allowed', example: false })
  @IsOptional() @IsBoolean() allowRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Allowed recurring patterns', enum: RecurringPatternDto, isArray: true })
  @IsOptional() @IsArray() @IsEnum(RecurringPatternDto, { each: true })
  allowedRecurringPatterns?: RecurringPatternDto[];

  @ApiPropertyOptional({ description: 'Maximum number of recurrences', example: 12 })
  @IsOptional() @IsInt() @Min(1) maxRecurrences?: number;

  // ─── الجلسات الجماعية ────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Minimum participants for a group session', example: 1 })
  @IsOptional() @IsInt() @Min(1) minParticipants?: number;

  @ApiPropertyOptional({ description: 'Maximum participants for a group session', example: 1 })
  @IsOptional() @IsInt() @Min(1) maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Allow reservation without payment until minimum participants is reached', example: false })
  @IsOptional() @IsBoolean() reserveWithoutPayment?: boolean;
}
