import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import type { InboxAssignmentFilter } from './list-inbox.handler';

export class ListInboxDto {
  @ApiPropertyOptional({ description: 'Conversation status filter', enum: ConversationStatus })
  @IsOptional() @IsEnum(ConversationStatus) status?: ConversationStatus;

  @ApiPropertyOptional({ description: 'Return conversations with unread staff messages only', example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' ? true : value === false || value === 'false' ? false : value)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Assignment filter', enum: ['all', 'me', 'unassigned'], example: 'unassigned' })
  @IsOptional() @IsIn(['all', 'me', 'unassigned']) assigned?: InboxAssignmentFilter;

  @ApiPropertyOptional({ description: 'Search guest name or phone', example: 'سارة' })
  @IsOptional() @IsString() @MaxLength(100) search?: string;

  @ApiPropertyOptional({ description: 'Conversation creation start date', example: '2026-08-01T00:00:00.000Z' })
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;

  @ApiPropertyOptional({ description: 'Conversation creation end date', example: '2026-08-31T23:59:59.000Z' })
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;

  @ApiPropertyOptional({ description: 'Conversation UUID keyset cursor', example: '00000000-0000-4000-a000-000000000001' })
  @IsOptional() @IsUUID() cursor?: string;

  @ApiPropertyOptional({ description: 'Number of conversations to return', minimum: 1, maximum: 100, example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
