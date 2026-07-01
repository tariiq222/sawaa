import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

/**
 * Find a client's usable session-package credits eligible for a specific
 * (service, employee, duration[, delivery type]) booking — used by the dashboard
 * to auto-suggest "book from credit". A credit is eligible when the booking
 * satisfies all of its multi-dimensional constraints (see package-credit-matching).
 */
export class GetMatchingCreditsDto {
  @ApiProperty({ description: 'Client to search credits for', example: '00000000-0000-4000-a000-000000000001', format: 'uuid' })
  @IsUUID()
  clientId!: string;

  @ApiProperty({ description: 'Service being booked', example: '00000000-0000-4000-a000-000000000002', format: 'uuid' })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ description: 'Practitioner being booked', example: '00000000-0000-4000-a000-000000000003', format: 'uuid' })
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ description: 'Duration option being booked', example: '00000000-0000-4000-a000-000000000004', format: 'uuid' })
  @IsUUID()
  durationOptionId!: string;

  @ApiPropertyOptional({ description: 'Delivery type of the booking (for DELIVERY_TYPE-scoped credits)', enum: DeliveryType })
  @IsOptional() @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;
}
