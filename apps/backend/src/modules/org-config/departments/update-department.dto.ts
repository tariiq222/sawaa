import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const NOT_WHITESPACE_ONLY = /\S/;

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ description: 'Department name in Arabic', example: 'قسم الأسنان' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(NOT_WHITESPACE_ONLY, { message: 'nameAr must not be whitespace only' })
  nameAr?: string;

  @ApiPropertyOptional({ description: 'Department name in English', example: 'Dental Department' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(NOT_WHITESPACE_ONLY, { message: 'nameEn must not be whitespace only' })
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Department description in Arabic', example: 'قسم طب وجراحة الفم والأسنان' })
  @IsOptional() @IsString() @MaxLength(1000) descriptionAr?: string;

  @ApiPropertyOptional({ description: 'Department description in English', example: 'Oral and dental surgery department' })
  @IsOptional() @IsString() @MaxLength(1000) descriptionEn?: string;

  @ApiPropertyOptional({ description: 'Icon identifier (e.g. Lucide icon name)', example: 'tooth' })
  @IsOptional() @IsString() @MaxLength(100) icon?: string;

  @ApiPropertyOptional({ description: 'Whether the department is visible to clients', example: true })
  @IsOptional() @IsBoolean() isVisible?: boolean;

  @ApiPropertyOptional({ description: 'Display order (0-based)', example: 1 })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the department is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
