import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
};

export class ListBranchesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search branches by name or city', example: 'Riyadh' })
  @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional() @Type(() => String) @Transform(toBoolean) @IsBoolean() isActive?: boolean;
}
