import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name in Arabic', example: 'طب الأسنان' })
  @IsString() @MaxLength(200) nameAr!: string;

  @ApiPropertyOptional({ description: 'Category name in English', example: 'Dentistry' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'UUID of the parent department', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() departmentId?: string;

  @ApiPropertyOptional({ description: 'Display order (0-based, lower sorts first)', example: 0 })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
