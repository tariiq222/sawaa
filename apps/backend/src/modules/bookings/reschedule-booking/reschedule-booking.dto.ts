import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RescheduleBookingDto {
  @ApiProperty({ description: 'New start datetime (ISO 8601)', example: '2026-05-10T10:00:00.000Z' })
  @IsDateString() newScheduledAt!: string;

  @ApiPropertyOptional({ description: 'Override session duration in minutes', example: 45 })
  @IsOptional() @IsInt() @Min(1) newDurationMins?: number;
}
