import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IntakeFieldType, IntakeFormType, IntakeFormScope } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IntakeFieldInputDto {
  @ApiProperty({ description: 'Field label in Arabic', example: 'هل لديك حساسية؟' })
  @IsString() @MaxLength(200) labelAr!: string;

  @ApiPropertyOptional({ description: 'Field label in English', example: 'Do you have any allergies?' })
  @IsOptional() @IsString() @MaxLength(200) labelEn?: string;

  @ApiProperty({ description: 'Input field type', enum: IntakeFieldType, example: IntakeFieldType.TEXT })
  @IsEnum(IntakeFieldType) fieldType!: IntakeFieldType;

  @ApiPropertyOptional({ description: 'Whether the field is required', example: true })
  @IsOptional() @IsBoolean() isRequired?: boolean;

  @ApiPropertyOptional({ description: 'Selectable options for RADIO/SELECT/CHECKBOX fields', example: ['نعم', 'لا'] })
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];

  @ApiPropertyOptional({ description: 'Display order position (0-based)', example: 0 })
  @IsOptional() @IsInt() @Min(0) position?: number;
}

export class CreateIntakeFormDto {
  @ApiProperty({ description: 'Form name in Arabic', example: 'استبيان ما قبل الجلسة' })
  @IsString() @MaxLength(200) nameAr!: string;

  @ApiPropertyOptional({ description: 'Form name in English', example: 'Pre-session Questionnaire' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiProperty({ description: 'Form type', enum: IntakeFormType, example: IntakeFormType.PRE_SESSION })
  @IsEnum(IntakeFormType) type!: IntakeFormType;

  @ApiProperty({ description: 'Form scope', enum: IntakeFormScope, example: IntakeFormScope.GLOBAL })
  @IsEnum(IntakeFormScope) scope!: IntakeFormScope;

  @ApiPropertyOptional({ description: 'Scope entity ID (null for global scope)', example: null })
  @IsOptional() @IsString() scopeId?: string;

  @ApiPropertyOptional({ description: 'Whether the form is active and shown to clients', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Form fields (max 100)', type: [IntakeFieldInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => IntakeFieldInputDto)
  fields?: IntakeFieldInputDto[];
}
