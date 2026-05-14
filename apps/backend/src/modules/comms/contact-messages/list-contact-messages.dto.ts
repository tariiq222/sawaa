import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContactMessageStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class ListContactMessagesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: ContactMessageStatus })
  @IsOptional() @IsEnum(ContactMessageStatus) status?: ContactMessageStatus;
}
