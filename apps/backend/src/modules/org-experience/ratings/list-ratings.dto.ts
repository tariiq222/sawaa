import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class ListRatingsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter ratings by employee UUID', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsOptional() @IsUUID() employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter ratings by client UUID', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional() @IsUUID() clientId?: string;
}
