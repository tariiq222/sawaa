import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MarkReadDto {
  @ApiPropertyOptional({
    description: 'UUID of a specific notification to mark as read. Omit to mark all as read.',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsOptional() @IsUUID() notificationId?: string;
}
