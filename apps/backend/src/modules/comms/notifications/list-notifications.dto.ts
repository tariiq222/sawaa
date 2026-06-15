import { IsBoolean, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
};

export class ListNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Return only unread notifications', example: true })
  @IsOptional()
  @Type(() => String)
  @Transform(toBoolean)
  @IsBoolean()
  unreadOnly?: boolean;
}
