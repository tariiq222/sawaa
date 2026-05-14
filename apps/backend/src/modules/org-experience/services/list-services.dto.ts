import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
};

export class ListServicesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional() @Type(() => String) @Transform(toBoolean) @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Include hidden services', example: false })
  @IsOptional() @Type(() => String) @Transform(toBoolean) @IsBoolean() includeHidden?: boolean;

  @ApiPropertyOptional({ description: 'Filter by category UUID', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ description: 'Search by name', example: 'haircut' })
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
