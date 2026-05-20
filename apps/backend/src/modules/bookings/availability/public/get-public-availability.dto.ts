import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingType, DeliveryType } from '@prisma/client';

export class GetPublicAvailabilityDto {
  @ApiProperty({ description: 'Date to check availability (YYYY-MM-DD)', example: '2026-04-20' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: 'Service ID to check availability for', example: '00000000-0000-0000-0000-000000000001' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Branch ID', example: '00000000-0000-0000-0000-000000000002' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Specific duration option to resolve duration', example: '00000000-0000-0000-0000-000000000003' })
  @IsOptional()
  @IsUUID()
  durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Delivery channel', enum: DeliveryType, enumName: 'DeliveryType', example: DeliveryType.IN_PERSON })
  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @ApiPropertyOptional({ description: 'Booking type context', enum: BookingType, enumName: 'BookingType', example: BookingType.INDIVIDUAL })
  @IsOptional()
  @IsString()
  bookingType?: BookingType | 'ONLINE';
}
