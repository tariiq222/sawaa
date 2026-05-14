import { BookingType, RecurringFrequency } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
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

/**
 * Payload for creating a recurring series of bookings.
 *
 * Exactly one of `occurrences` or `until` must be provided — the handler
 * validates this and throws BadRequestException otherwise.
 *
 * For CUSTOM frequency, `customDates` must be provided; `intervalDays` is ignored.
 * For DAILY/WEEKLY, `intervalDays` controls the gap (default 1 for DAILY, 7 for WEEKLY).
 */
export class CreateRecurringBookingDto {
  @ApiProperty({ description: 'Branch where bookings take place', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Client being booked', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() clientId!: string;

  @ApiProperty({ description: 'Employee performing the service', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Service to be performed', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() serviceId!: string;

  /** First occurrence */
  @ApiProperty({ description: 'ISO 8601 datetime of the first occurrence', example: '2026-05-01T09:00:00.000Z' })
  @IsDateString() scheduledAt!: string;

  @ApiProperty({ description: 'Duration of each session in minutes', example: 60 })
  @IsInt() @Min(1) durationMins!: number;

  @ApiProperty({ description: 'Price per session', example: 150 })
  @IsNumber() @Min(0) price!: number;

  @ApiPropertyOptional({ description: 'Currency code (ISO 4217)', example: 'SAR' })
  @IsOptional() @IsString() currency?: string;

  @ApiPropertyOptional({ description: 'Booking type', enum: BookingType, enumName: 'BookingType', example: BookingType.INDIVIDUAL })
  @IsOptional() @Transform(({ value }) => mapBookingType(value)) @IsEnum(BookingType) bookingType?: BookingType;

  @ApiPropertyOptional({ description: 'Notes applied to each booking in the series', example: 'Weekly follow-up' })
  @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: 'Expiry datetime for each booking (ISO 8601)', example: '2026-05-01T12:00:00.000Z' })
  @IsOptional() @IsDateString() expiresAt?: string;

  @ApiProperty({ description: 'Recurrence frequency', enum: RecurringFrequency, enumName: 'RecurringFrequency', example: RecurringFrequency.WEEKLY })
  @IsEnum(RecurringFrequency) frequency!: RecurringFrequency;

  @ApiPropertyOptional({ description: 'Interval in days between bookings (DAILY/WEEKLY only)', example: 7 })
  @IsOptional() @IsInt() @Min(1) intervalDays?: number;

  @ApiPropertyOptional({ description: 'Number of bookings to create (mutually exclusive with until)', example: 8 })
  @IsOptional() @IsInt() @Min(1) occurrences?: number;

  @ApiPropertyOptional({ description: 'Last possible date for the series, inclusive (mutually exclusive with occurrences)', example: '2026-07-01T00:00:00.000Z' })
  @IsOptional() @IsDateString() until?: string;

  @ApiPropertyOptional({ description: 'Exact list of dates for CUSTOM frequency', example: ['2026-05-01T09:00:00.000Z', '2026-05-15T09:00:00.000Z'], type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsDateString({}, { each: true })
  customDates?: string[];

  @ApiPropertyOptional({ description: 'Skip conflicting slots silently instead of aborting the series', example: false })
  @IsOptional() @IsBoolean() skipConflicts?: boolean;
}
