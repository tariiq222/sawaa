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

  @ApiPropertyOptional({ description: 'Department description in Arabic; null clears it', type: String, nullable: true, example: 'قسم طب وجراحة الفم والأسنان' })
  @IsOptional() @IsString() @MaxLength(1000) descriptionAr?: string | null;

  @ApiPropertyOptional({ description: 'Department description in English; null clears it', type: String, nullable: true, example: 'Oral and dental surgery department' })
  @IsOptional() @IsString() @MaxLength(1000) descriptionEn?: string | null;

  @ApiPropertyOptional({ description: 'Icon identifier; null clears it', type: String, nullable: true, example: 'tooth' })
  @IsOptional() @IsString() @MaxLength(100) icon?: string | null;

  @ApiPropertyOptional({ description: 'Whether the department is visible to clients', example: true })
  @IsOptional() @IsBoolean() isVisible?: boolean;

  @ApiPropertyOptional({ description: 'Display order (0-based)', example: 1 })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the department is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
