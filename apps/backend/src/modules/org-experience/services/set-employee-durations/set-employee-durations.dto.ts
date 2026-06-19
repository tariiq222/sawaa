import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmployeeDurationItemDto {
  @ApiPropertyOptional({ description: 'Existing row ID to update (omit to create)', example: 'uuid' })
  @IsOptional() @IsUUID() id?: string;

  @ApiProperty({ description: 'English label', example: '60 min session' })
  @IsString() label!: string;

  @ApiProperty({ description: 'Arabic label', example: 'جلسة 60 دقيقة' })
  @IsString() labelAr!: string;

  @ApiProperty({ description: 'Duration in minutes (≥ 1)', example: 60 })
  @IsInt() @Min(1) durationMins!: number;

  @ApiProperty({ description: 'Price in halalas (integer, ≥ 0)', example: 30000 })
  @IsInt() @Min(0) price!: number;
}

export class EmployeeDurationsByTypeDto {
  @ApiProperty({ description: 'Delivery type', example: 'IN_PERSON' })
  @IsString() deliveryType!: string;

  @ApiProperty({ description: 'Duration items for this delivery type', type: [EmployeeDurationItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => EmployeeDurationItemDto)
  items!: EmployeeDurationItemDto[];
}

export class SetEmployeeDurationsDto {
  @ApiProperty({ description: 'Duration rows grouped by delivery type', type: [EmployeeDurationsByTypeDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => EmployeeDurationsByTypeDto)
  durations!: EmployeeDurationsByTypeDto[];
}

export type SetEmployeeDurationsCommand = SetEmployeeDurationsDto & {
  employeeId: string;
  serviceId: string;
};
