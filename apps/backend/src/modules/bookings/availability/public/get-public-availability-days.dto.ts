import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingType, DeliveryType } from '@prisma/client';
import { mapBookingType, PUBLIC_BOOKING_TYPE_ALLOWLIST } from '../../booking-enum-transforms';

/**
 * Query contract for the day-strip probe
 * (GET /api/v1/public/employees/:id/availability/days).
 *
 * All fields are optional: the handler falls back to the employee's resolved
 * branch/service links and the service's default duration when the wizard has
 * not produced a choice yet. durationMins/deliveryType/bookingType are
 * validated here (never NaN, never a raw cast into the Prisma enums) so the
 * per-day probes always reach CheckAvailability with the same duration and
 * delivery context as the slot fetch.
 */
export class GetPublicAvailabilityDaysDto {
  @ApiPropertyOptional({ description: 'Service ID to probe availability for', example: '00000000-0000-0000-0000-000000000001' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Branch ID', example: '00000000-0000-0000-0000-000000000002' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Inclusive ISO date the window starts at (YYYY-MM-DD). Defaults to today.', example: '2026-05-24' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'How many consecutive days to check. Defaults to 14, capped at 31.', example: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;

  @ApiPropertyOptional({ description: 'Specific duration option to resolve duration', example: '00000000-0000-0000-0000-000000000003' })
  @IsOptional()
  @IsUUID()
  durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Session duration in minutes (overrides the option lookup)', example: 45 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMins?: number;

  @ApiPropertyOptional({ description: 'Delivery channel', enum: DeliveryType, enumName: 'DeliveryType', example: DeliveryType.IN_PERSON })
  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @ApiPropertyOptional({ description: 'Booking type context', enum: BookingType, enumName: 'BookingType', example: BookingType.INDIVIDUAL })
  @IsOptional()
  @Transform(({ value }) => mapBookingType(value))
  @IsIn(PUBLIC_BOOKING_TYPE_ALLOWLIST)
  bookingType?: BookingType | 'ONLINE';
}
