import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

export class MarkConversationReadDto {
  @ApiPropertyOptional({ description: 'Owned message UUID through which messages are marked read', example: '00000000-0000-4000-a000-000000000001' })
  @IsOptional()
  @IsUUID()
  throughMessageId?: string;

  @ApiPropertyOptional({ description: 'Highest owned message sequence to mark as read', example: '42' })
  @IsOptional()
  @Matches(/^\d+$/)
  throughSequence?: string;
}
