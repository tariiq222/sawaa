import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingType, DeliveryType } from '@prisma/client';
import { mapDeliveryType } from '../booking-enum-transforms';

/**
 * Keep validation permissive for legacy delivery aliases sent as bookingType.
 * The handler normalizes to (BookingType, DeliveryType).
 */
const mapBookingType = (v: unknown) => {
  if (typeof v !== 'string' || !v) return v;
  const lower = v.toLowerCase();
  if (lower === 'in_person') return 'INDIVIDUAL';
  return v.toUpperCase();
};

/**
 * Public website booking input for an AUTHENTICATED client.
 *
 * SECURITY: `clientId` is intentionally NOT part of this DTO — it is taken from
 * the verified client session (ClientSessionGuard), never from the request body.
 * The previous guest-booking flow (raw name/phone/email + OTP session) has been
 * removed: a full client account + login is now required before booking.
 */
export class CreatePublicBookingDto {
  @ApiProperty({ description: 'Service ID', example: '00000000-0000-0000-0000-000000000001' })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ description: 'Employee ID', example: '00000000-0000-0000-0000-000000000002' })
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ description: 'Branch ID', example: '00000000-0000-0000-0000-000000000003' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ description: 'Booking start time (ISO 8601)', example: '2026-04-20T09:00:00Z' })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({ description: 'Delivery channel (IN_PERSON or ONLINE)', enum: DeliveryType, enumName: 'DeliveryType', example: DeliveryType.IN_PERSON })
  @IsOptional() @Transform(({ value }) => mapDeliveryType(value)) @IsEnum(DeliveryType) deliveryType?: DeliveryType;

  @ApiPropertyOptional({ description: 'Specific duration option to resolve price and duration', example: '00000000-0000-0000-0000-000000000004' })
  @IsOptional() @IsUUID() durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Booking type (legacy — prefer deliveryType)', enum: BookingType, enumName: 'BookingType', example: BookingType.INDIVIDUAL })
  @IsOptional() @Transform(({ value }) => mapBookingType(value)) @IsString() bookingType?: BookingType | 'ONLINE';

  @ApiPropertyOptional({ description: 'Discount coupon code', example: 'SAVE10' })
  @IsOptional() @IsString() couponCode?: string;

  @ApiPropertyOptional({ description: 'Additional notes for the booking', example: 'First visit' })
  @IsOptional() @IsString() notes?: string;
}
