import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListChatMessagesDto {
  @ApiPropertyOptional({ description: 'Cursor (message UUID) for keyset pagination', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() cursor?: string;

  @ApiPropertyOptional({ description: 'Number of web chat messages to return', example: 20, maximum: 100 })
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number;
}
