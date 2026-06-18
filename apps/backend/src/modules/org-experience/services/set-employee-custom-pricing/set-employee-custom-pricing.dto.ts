import { IsArray, IsBoolean, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CustomPricingTypeDto {
  @ApiProperty({ description: 'Delivery type (IN_PERSON or ONLINE)', example: 'IN_PERSON' })
  @IsString() deliveryType!: string;

  @ApiProperty({ description: 'Price in halalas (integer, ≥ 0)', example: 30000 })
  @IsInt() @Min(0) price!: number;

  @ApiProperty({ description: 'Duration in minutes (≥ 1)', example: 60 })
  @IsInt() @Min(1) durationMins!: number;
}

export class SetEmployeeCustomPricingDto {
  @ApiProperty({ description: 'Enable custom pricing for this employee', example: true })
  @IsBoolean() enabled!: boolean;

  @ApiProperty({ description: 'Pricing entries per delivery type', type: [CustomPricingTypeDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CustomPricingTypeDto)
  types!: CustomPricingTypeDto[];
}

export type SetEmployeeCustomPricingCommand = SetEmployeeCustomPricingDto & {
  employeeId: string;
  serviceId: string;
};
