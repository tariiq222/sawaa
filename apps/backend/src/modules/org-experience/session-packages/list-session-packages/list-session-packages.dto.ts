import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../../common/dto';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
};

export class ListSessionPackagesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional() @Type(() => String) @Transform(toBoolean) @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by public visibility', example: true })
  @IsOptional() @Type(() => String) @Transform(toBoolean) @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Search by Arabic or English name (case-insensitive contains)', maxLength: 100, example: 'family' })
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;
}