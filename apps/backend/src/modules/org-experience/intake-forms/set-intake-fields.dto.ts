import { ArrayMaxSize, IsArray, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IntakeFieldInputDto } from './create-intake-form.dto';

export class SetIntakeFieldsDto {
  @ApiPropertyOptional({ description: 'Replacement field list (max 100). Omit or pass [] to clear all fields.', type: [IntakeFieldInputDto] })
  @ValidateIf((object) => object.fields !== undefined) @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => IntakeFieldInputDto)
  fields?: IntakeFieldInputDto[];
}
