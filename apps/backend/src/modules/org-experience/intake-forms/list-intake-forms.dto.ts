import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListIntakeFormsDto {
  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}
