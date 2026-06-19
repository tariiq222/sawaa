import { GroupSessionStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

const toBoolean = (raw: unknown) =>
  raw === undefined ? undefined : raw === true || raw === 'true';

export class ListGroupSessionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by session status', enum: GroupSessionStatus, enumName: 'GroupSessionStatus', example: GroupSessionStatus.OPEN })
  @IsOptional() @IsEnum(GroupSessionStatus) status?: GroupSessionStatus;

  @ApiPropertyOptional({ description: 'Return only upcoming sessions (scheduledAt >= now)', example: true })
  @IsOptional() @Transform(({ obj }) => toBoolean((obj as Record<string, unknown>).upcoming)) @IsBoolean() upcoming?: boolean;
}
