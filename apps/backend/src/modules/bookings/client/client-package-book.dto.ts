import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class ClientPackageBookDto {
  @ApiProperty({ description: 'Exact package credit bucket to book', format: 'uuid' })
  @IsUUID()
  creditId!: string;

  @ApiProperty({ description: 'Branch where the appointment takes place', format: 'uuid' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ description: 'Appointment start time', format: 'date-time' })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ description: 'Service target for legacy flexible credits', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Practitioner target for legacy flexible credits', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Duration target for legacy flexible credits', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Delivery channel for legacy flexible credits', enum: DeliveryType })
  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @ApiPropertyOptional({ description: 'Optional note attached to the booking' })
  @IsOptional()
  @IsString()
  notes?: string;
}
