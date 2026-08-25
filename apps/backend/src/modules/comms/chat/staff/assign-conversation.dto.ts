import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignConversationDto {
  @ApiProperty({ description: 'Active dashboard user UUID to assign', example: '00000000-0000-4000-a000-000000000001' })
  @IsUUID()
  targetStaffUserId!: string;
}
