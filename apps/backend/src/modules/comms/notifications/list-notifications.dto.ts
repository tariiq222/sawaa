import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class ListNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Return only unread notifications', example: true })
  @IsOptional() @IsBoolean() @Type(() => Boolean) unreadOnly?: boolean;
}
