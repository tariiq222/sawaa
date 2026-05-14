import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RefundType } from '@prisma/client';

export class UpsertBookingSettingsDto {
  @ApiPropertyOptional({ description: 'Buffer time between bookings in minutes', example: 15 })
  @IsOptional() @IsInt() @Min(0) @Max(120) bufferMinutes?: number;

  @ApiPropertyOptional({ description: 'Hours before booking start that free cancellation is allowed', example: 24 })
  @IsOptional() @IsInt() @Min(0) freeCancelBeforeHours?: number;

  @ApiPropertyOptional({ description: 'Refund type when free cancellation window is used', enum: RefundType, enumName: 'RefundType' })
  @IsOptional() @IsEnum(RefundType) freeCancelRefundType?: RefundType;

  @ApiPropertyOptional({ description: 'Percentage refunded on late cancellation (0–100)', example: 50 })
  @IsOptional() @IsInt() @Min(0) @Max(100) lateCancelRefundPercent?: number;

  @ApiPropertyOptional({ description: 'Maximum number of reschedules allowed per booking', example: 2 })
  @IsOptional() @IsInt() @Min(0) maxReschedulesPerBooking?: number;

  @ApiPropertyOptional({ description: 'Hours after booking start to auto-complete the booking', example: 1 })
  @IsOptional() @IsInt() @Min(0) autoCompleteAfterHours?: number;

  @ApiPropertyOptional({ description: 'Minutes after booking start to auto-mark as no-show', example: 30 })
  @IsOptional() @IsInt() @Min(0) autoNoShowAfterMinutes?: number;

  @ApiPropertyOptional({ description: 'Minimum lead time in minutes before a booking can be created', example: 60 })
  @IsOptional() @IsInt() @Min(0) minBookingLeadMinutes?: number;

  @ApiPropertyOptional({ description: 'Maximum days in advance a booking can be made', example: 90 })
  @IsOptional() @IsInt() @Min(1) maxAdvanceBookingDays?: number;

  @ApiPropertyOptional({ description: 'Whether the waitlist is enabled', example: true })
  @IsOptional() @IsBoolean() waitlistEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Maximum waitlist entries per slot', example: 5 })
  @IsOptional() @IsInt() @Min(1) waitlistMaxPerSlot?: number;

  @ApiPropertyOptional({ description: 'Whether pay-at-clinic option is enabled', example: true })
  @IsOptional() @IsBoolean() payAtClinicEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Whether cancellations require approval', example: false })
  @IsOptional() @IsBoolean() requireCancelApproval?: boolean;

  @ApiPropertyOptional({ description: 'Whether to automatically refund on cancellation', example: true })
  @IsOptional() @IsBoolean() autoRefundOnCancel?: boolean;
}
