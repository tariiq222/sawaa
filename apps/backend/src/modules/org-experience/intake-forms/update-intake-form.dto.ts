import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IntakeFormScope, IntakeFormType } from '@prisma/client';
import { IntakeFieldInputDto } from './create-intake-form.dto';

export class UpdateIntakeFormDto {
  @ApiPropertyOptional({ description: 'Form name in Arabic', example: 'استبيان ما قبل الجلسة' })
  @ValidateIf((object) => object.nameAr !== undefined) @IsString() @MaxLength(200) nameAr?: string;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Form name in English', example: 'Pre-session Questionnaire' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string | null;

  @ApiPropertyOptional({ description: 'Whether the form is active and shown to clients', example: true })
  @ValidateIf((object) => object.isActive !== undefined) @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Form type', enum: IntakeFormType, example: IntakeFormType.PRE_SESSION })
  @ValidateIf((object) => object.type !== undefined)
  @IsEnum(IntakeFormType)
  type?: IntakeFormType;

  @ApiPropertyOptional({ description: 'Form scope', enum: IntakeFormScope, example: IntakeFormScope.GLOBAL })
  @ValidateIf((object) => object.scope !== undefined)
  @IsEnum(IntakeFormScope)
  scope?: IntakeFormScope;

  @ApiPropertyOptional({ type: String, description: 'Scope entity ID; null clears the scope target', example: null, nullable: true })
  @IsOptional() @IsString()
  scopeId?: string | null;

  @ApiPropertyOptional({ description: 'Optional replacement field list (max 100)', type: [IntakeFieldInputDto] })
  @ValidateIf((object) => object.fields !== undefined)
  @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => IntakeFieldInputDto)
  fields?: IntakeFieldInputDto[];
}
