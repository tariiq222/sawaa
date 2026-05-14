import { BookingStatus, BookingType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

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
 * Dashboard sends booking status as lowercase string.
 */
const mapBookingStatus = (v: unknown) => {
  if (typeof v !== 'string' || !v) return v;
  return v.toUpperCase();
};

export class ListBookingsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by client', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by employee', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by branch', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by service', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() serviceId?: string;

  @ApiPropertyOptional({ description: 'Filter by booking status', enum: BookingStatus, enumName: 'BookingStatus', example: BookingStatus.CONFIRMED })
  @IsOptional() @Transform(({ value }) => mapBookingStatus(value)) @IsEnum(BookingStatus) status?: BookingStatus;

  @ApiPropertyOptional({ description: 'Filter by booking type', enum: BookingType, enumName: 'BookingType', example: BookingType.INDIVIDUAL })
  @IsOptional() @Transform(({ value }) => mapBookingType(value)) @IsEnum(BookingType) bookingType?: BookingType;

  @ApiPropertyOptional({ description: 'Return bookings on or after this date (ISO 8601)', example: '2026-05-01T00:00:00.000Z' })
  @IsOptional() @IsDateString() fromDate?: string;

  @ApiPropertyOptional({ description: 'Return bookings on or before this date (ISO 8601)', example: '2026-05-31T23:59:59.000Z' })
  @IsOptional() @IsDateString() toDate?: string;

  @ApiPropertyOptional({ description: 'Search by booking id or client name', example: 'bkg-1' })
  @IsOptional() @IsString() @MaxLength(120) search?: string;

  @ApiPropertyOptional({ description: 'Filter guest (online) vs walk-in bookings', example: true })
  @IsOptional() isGuest?: boolean;
}
