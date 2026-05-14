import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
