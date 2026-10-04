import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClientCancelBookingDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Opaque cancellation preview token; refresh preview after conflict' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  quoteToken?: string;

  @ApiPropertyOptional({ description: 'Stable UUID for retrying the same cancellation', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceActionId?: string;
}
