import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateIntakeFormDto {
  @ApiPropertyOptional({ description: 'Form name in Arabic', example: 'استبيان ما قبل الجلسة' })
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;

  @ApiPropertyOptional({ description: 'Form name in English', example: 'Pre-session Questionnaire' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'Whether the form is active and shown to clients', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
