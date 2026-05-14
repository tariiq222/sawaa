import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClientRescheduleBookingDto {
  @ApiPropertyOptional({ description: 'New appointment time (ISO 8601)' })
  @IsDateString()
  newScheduledAt!: string;

  @ApiPropertyOptional({ description: 'New duration in minutes (optional — keeps existing if omitted)' })
  @IsOptional()
  @IsInt()
  @Min(15)
  newDurationMins?: number;
}
