import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListHolidaysDto {
  @ApiProperty({ description: 'ID of the branch to list holidays for', example: 'main-branch' })
  @IsString() @MaxLength(100) @Type(() => String) branchId!: string;

  @ApiPropertyOptional({ description: 'Filter by year (2000–3000)', example: 2025 })
  @IsOptional() @IsInt() @Min(2000) @Max(3000) @Type(() => Number) year?: number;
}
