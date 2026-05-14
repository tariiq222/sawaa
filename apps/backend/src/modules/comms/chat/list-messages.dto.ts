import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListMessagesDto {
  @ApiPropertyOptional({ description: 'Cursor (message UUID) for keyset pagination', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() cursor?: string;

  @ApiPropertyOptional({ description: 'Number of messages to return', example: 20 })
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}
