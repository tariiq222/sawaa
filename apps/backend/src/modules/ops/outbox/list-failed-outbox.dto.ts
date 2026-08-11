import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListFailedOutboxDto {
  @ApiPropertyOptional({
    description: 'Maximum number of events to return (default 50, max 100)',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by exact outbox event type',
    example: 'bookings.booking.created',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  eventType?: string;
}
