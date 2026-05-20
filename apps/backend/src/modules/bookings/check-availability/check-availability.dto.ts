import { BookingType, DeliveryType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Dashboard may still send legacy delivery aliases as bookingType.
 * Keep validation permissive here; the handler normalizes to BookingType + DeliveryType.
 */
const mapBookingType = (v: unknown) => {
  if (typeof v !== 'string' || !v) return v;
  const lower = v.toLowerCase();
  if (lower === 'in_person') return 'INDIVIDUAL';
  return v.toUpperCase();
};

export class CheckAvailabilityDto {
  @ApiProperty({ description: 'Employee whose availability to check', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Branch to check availability at', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Date to check availability for (ISO 8601)', example: '2026-05-01T00:00:00.000Z' })
  @IsDateString() date!: string;

  @ApiPropertyOptional({ description: 'Session duration in minutes (overrides service default)', example: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMins?: number;

  @ApiPropertyOptional({ description: 'Service to check availability for', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() serviceId?: string;

  @ApiPropertyOptional({ description: 'Specific duration option to resolve duration', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Booking type context for availability check', enum: BookingType, enumName: 'BookingType', example: BookingType.INDIVIDUAL })
  @IsOptional() @Transform(({ value }) => mapBookingType(value)) @IsString() bookingType?: BookingType | 'ONLINE';

  @ApiPropertyOptional({ description: 'Delivery channel context for availability check', enum: DeliveryType, enumName: 'DeliveryType', example: DeliveryType.IN_PERSON })
  @IsOptional() @IsEnum(DeliveryType) deliveryType?: DeliveryType;
}
