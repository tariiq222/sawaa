import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class ListConversationsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter conversations by client UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() clientId?: string;

  @ApiPropertyOptional({ description: 'Filter conversations by employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() employeeId?: string;
}
