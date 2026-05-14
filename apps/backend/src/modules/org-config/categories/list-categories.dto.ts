import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
};

export class ListCategoriesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by department UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() departmentId?: string;

  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional() @Type(() => String) @Transform(toBoolean) @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search categories by name', example: 'dental' })
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
