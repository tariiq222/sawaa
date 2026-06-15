import { IsBoolean, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
};

export class ListIntakeFormsDto {
  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional()
  @Type(() => String)
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
