import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { DeliveryType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBundleBookingDto {
  @ApiProperty({ description: 'Branch where the bundle booking takes place', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Client being booked', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() clientId!: string;

  @ApiProperty({ description: 'Employee performing all bundle services', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Service bundle to book', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() bundleId!: string;

  @ApiProperty({ description: 'ISO 8601 start datetime for the first service in the bundle', example: '2026-05-01T09:00:00.000Z' })
  @IsDateString() scheduledAt!: string;

  @ApiPropertyOptional({ description: 'Free-text notes for the bookings', example: 'Client prefers quiet room' })
  @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: 'Payment collected at the clinic instead of online', example: false })
  @IsOptional() @IsBoolean() payAtClinic?: boolean;

  @ApiPropertyOptional({ description: 'Delivery channel for all bundle bookings (IN_PERSON or ONLINE)', enum: DeliveryType, enumName: 'DeliveryType', example: DeliveryType.IN_PERSON })
  @IsOptional() @IsEnum(DeliveryType) deliveryType?: DeliveryType;
}
