import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityAction } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class ListActivityDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter log entries by staff user UUID',
    example: 'c1d2e3f4-a5b6-7890-cdef-012345678901',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity type name (e.g. Booking, Client, Employee)',
    example: 'Booking',
  })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional({
    description: 'Filter by the UUID of the affected entity',
    example: 'd4e5f6a7-b8c9-0123-defa-456789012345',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: ActivityAction,
    example: ActivityAction.CREATE,
  })
  @IsOptional()
  @IsEnum(ActivityAction)
  action?: ActivityAction;

  @ApiPropertyOptional({
    description: 'Start of date range (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End of date range (ISO 8601)',
    example: '2026-04-17',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
