import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmployeeServiceOptionInputDto {
  @ApiProperty({ description: 'Duration option UUID to configure for this employee', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID() durationOptionId!: string;

  @ApiPropertyOptional({ description: 'Employee-specific price override (null to use service default)', example: 45, nullable: true })
  @IsOptional() @IsNumber() @Min(0) priceOverride?: number | null;

  @ApiPropertyOptional({ description: 'Employee-specific duration override in minutes (null to use service default)', example: 35, nullable: true })
  @IsOptional() @IsInt() @Min(1) durationOverride?: number | null;

  // The shared OpenAPI enum schema "DeliveryType" is last-writer-wins across the
  // DTOs carrying enumName: 'DeliveryType'; module registration order decides
  // the winner. Every writer must keep this exact description or the snapshot
  // drifts when modules are rewired (MNT-19). The specific wording for this
  // field lives in the field name and the surrounding DTO documentation.
  @ApiPropertyOptional({ description: 'Delivery channel', enum: DeliveryType, enumName: 'DeliveryType', example: DeliveryType.IN_PERSON, nullable: true })
  @IsOptional() @IsEnum(DeliveryType) deliveryType?: DeliveryType | null;

  @ApiPropertyOptional({ description: 'Whether this option is active for the employee', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetEmployeeServiceOptionsDto {
  @ApiProperty({ description: 'Employee service option overrides (at least one required)', type: [EmployeeServiceOptionInputDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => EmployeeServiceOptionInputDto)
  options!: EmployeeServiceOptionInputDto[];
}
