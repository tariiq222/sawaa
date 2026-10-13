import { IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingType, DeliveryType } from '@prisma/client';
import { mapDeliveryType } from '../booking-enum-transforms';

const mapBookingType = (v: unknown) => {
  if (typeof v !== 'string' || !v) return v;
  const lower = v.toLowerCase();
  if (lower === 'in_person') return 'INDIVIDUAL';
  return v.toUpperCase();
};

/**
 * Canonical create-booking body for `POST /client/bookings` (website and app).
 * `clientId` and the channel come from the session, never from the body.
 */
export class ClientCreateBookingDto {
  @ApiProperty({ description: 'Service to be performed', format: 'uuid' })
  @IsUUID() serviceId!: string;

  @ApiProperty({ description: 'Employee performing the service', format: 'uuid' })
  @IsUUID() employeeId!: string;

  @ApiPropertyOptional({ description: 'Branch ID; resolved to the main branch when omitted', format: 'uuid' })
  @IsOptional() @IsUUID() branchId?: string;

  @ApiProperty({ description: 'ISO 8601 start datetime', example: '2026-05-01T09:00:00.000Z' })
  @IsDateString() scheduledAt!: string;

  @ApiPropertyOptional({ description: 'Specific duration option to resolve price and duration', format: 'uuid' })
  @IsOptional() @IsUUID() durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Booking type (legacy; prefer deliveryType)', enum: BookingType, enumName: 'BookingType' })
  @IsOptional() @Transform(({ value }) => mapBookingType(value)) @IsIn([...Object.values(BookingType), 'ONLINE']) bookingType?: BookingType | 'ONLINE';

  @ApiPropertyOptional({ description: 'Session delivery channel. Omitted defaults to IN_PERSON.', enum: DeliveryType, enumName: 'DeliveryType' })
  @IsOptional() @Transform(({ value }) => mapDeliveryType(value)) @IsEnum(DeliveryType) deliveryType?: DeliveryType;

  @ApiPropertyOptional({ description: 'Discount coupon code' })
  @IsOptional() @IsString() @MaxLength(64) couponCode?: string;

  @ApiPropertyOptional({ description: 'Free-text notes for the booking' })
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;

  @ApiPropertyOptional({
    description:
      'Client chose to pay at the center. The booking is confirmed without an online invoice and the amount is collected at reception. Rejected when pay-at-center is disabled.',
  })
  @IsOptional() @IsBoolean() payAtClinic?: boolean;
}
