import { BookingType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Dashboard sends booking-type as the UI's snake_case alias (in_person / online / walk_in).
 * The DB enum is INDIVIDUAL / ONLINE / WALK_IN / GROUP — map the UI alias before validating.
 */
const mapBookingType = (v: unknown) => {
  if (typeof v !== 'string' || !v) return v;
  const lower = v.toLowerCase();
  if (lower === 'in_person') return 'INDIVIDUAL';
  return v.toUpperCase();
};

export class CreateBookingDto {
  @ApiProperty({ description: 'Branch where the booking takes place', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Client being booked', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() clientId!: string;

  @ApiProperty({ description: 'Employee performing the service', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Service to be performed', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() serviceId!: string;

  @ApiProperty({ description: 'ISO 8601 start datetime', example: '2026-05-01T09:00:00.000Z' })
  @IsDateString() scheduledAt!: string;

  @ApiPropertyOptional({ description: 'Specific duration option to resolve price and duration', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Currency code (ISO 4217)', example: 'SAR' })
  @IsOptional() @IsString() currency?: string;

  @ApiPropertyOptional({ description: 'Booking type', enum: BookingType, enumName: 'BookingType', example: BookingType.INDIVIDUAL })
  @IsOptional() @Transform(({ value }) => mapBookingType(value)) @IsEnum(BookingType) bookingType?: BookingType;

  @ApiPropertyOptional({ description: 'Free-text notes for the booking', example: 'Client prefers morning sessions' })
  @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: 'Booking expiry datetime (ISO 8601)', example: '2026-05-01T12:00:00.000Z' })
  @IsOptional() @IsDateString() expiresAt?: string;

  @ApiPropertyOptional({ description: 'Group session to attach this booking to', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() groupSessionId?: string;

  @ApiPropertyOptional({ description: 'Payment collected at the clinic instead of online', example: true })
  @IsOptional() @IsBoolean() payAtClinic?: boolean;

  @ApiPropertyOptional({ description: 'Discount coupon code', example: 'SAVE10' })
  @IsOptional() @IsString() couponCode?: string;
}
