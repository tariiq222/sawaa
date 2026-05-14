import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmployeeServiceOptionInputDto {
  @ApiProperty({ description: 'Duration option UUID to configure for this employee', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID() durationOptionId!: string;

  @ApiPropertyOptional({ description: 'Employee-specific price override (null to use service default)', example: 45, nullable: true })
  @IsOptional() @IsNumber() @Min(0) priceOverride?: number | null;

  @ApiPropertyOptional({ description: 'Employee-specific duration override in minutes (null to use service default)', example: 35, nullable: true })
  @IsOptional() @IsInt() @Min(1) durationOverride?: number | null;

  @ApiPropertyOptional({ description: 'Whether this option is active for the employee', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetEmployeeServiceOptionsDto {
  @ApiProperty({ description: 'Employee service option overrides (at least one required)', type: [EmployeeServiceOptionInputDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => EmployeeServiceOptionInputDto)
  options!: EmployeeServiceOptionInputDto[];
}
