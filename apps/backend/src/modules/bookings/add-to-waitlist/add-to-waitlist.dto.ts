import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddToWaitlistDto {
  @ApiProperty({ description: 'Client to add to the waitlist', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() clientId!: string;

  @ApiProperty({ description: 'Preferred employee for the session', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Service the client wants', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() serviceId!: string;

  @ApiProperty({ description: 'Branch where the service should be performed', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiPropertyOptional({ description: 'Client-preferred date (ISO 8601)', example: '2026-05-15T00:00:00.000Z' })
  @IsOptional() @IsDateString() preferredDate?: string;

  @ApiPropertyOptional({ description: 'Additional notes for the waitlist entry', example: 'Morning slot preferred' })
  @IsOptional() @IsString() notes?: string;
}
