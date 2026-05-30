import { IsDateString, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClientRescheduleBookingDto {
  @ApiProperty({ description: 'New appointment time (ISO 8601)' })
  @IsNotEmpty()
  @IsDateString()
  newScheduledAt!: string;

  @ApiPropertyOptional({ description: 'New duration in minutes (optional — keeps existing if omitted)' })
  @IsOptional()
  @IsInt()
  @Min(15)
  newDurationMins?: number;
}
