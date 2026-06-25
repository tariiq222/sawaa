import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Find a client's usable session-package credits for a specific
 * (service, employee, duration) combination — used by the dashboard to
 * auto-suggest "book from credit" while creating a normal booking.
 */
export class GetMatchingCreditsDto {
  @ApiProperty({ description: 'Client to search credits for', example: '00000000-0000-4000-a000-000000000001', format: 'uuid' })
  @IsUUID()
  clientId!: string;

  @ApiProperty({ description: 'Service the credit must match exactly', example: '00000000-0000-4000-a000-000000000002', format: 'uuid' })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ description: 'Employee the credit must match exactly', example: '00000000-0000-4000-a000-000000000003', format: 'uuid' })
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ description: 'Duration option the credit must match exactly', example: '00000000-0000-4000-a000-000000000004', format: 'uuid' })
  @IsUUID()
  durationOptionId!: string;
}
