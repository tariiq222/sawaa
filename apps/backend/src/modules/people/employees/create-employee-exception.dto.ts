import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeExceptionDto {
  @ApiProperty({ description: 'Start date of the exception (ISO 8601)', example: '2026-05-01T09:00:00.000Z' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'End date of the exception (ISO 8601)', example: '2026-05-07T09:00:00.000Z' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    description: 'Optional end-of-day cutoff on the last day (ISO 8601). Null = full last day.',
    example: '2026-05-07T14:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'When true, only start-of-day onwards is blocked on startDate (partial first day).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isStartTimeOnly?: boolean;

  @ApiPropertyOptional({ description: 'Reason for the exception (e.g. annual leave)', example: 'Annual vacation' })
  @IsOptional()
  @IsString()
  reason?: string;
}
