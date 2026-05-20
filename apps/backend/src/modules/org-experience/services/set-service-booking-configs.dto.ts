import { DeliveryType } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookingConfigInputDto {
  @ApiProperty({
    description: 'Delivery channel for this service',
    enum: DeliveryType,
    enumName: 'DeliveryType',
    example: DeliveryType.IN_PERSON,
  })
  @IsOptional() @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @ApiProperty({ description: 'Price for this booking type', example: 50 })
  @IsNumber() @Min(0) price!: number;

  @ApiProperty({ description: 'Duration in minutes for this booking type', example: 30 })
  @IsInt() @Min(1) durationMins!: number;

  @ApiPropertyOptional({ description: 'Whether this config is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetServiceBookingConfigsDto {
  @ApiProperty({ description: 'Booking type configurations (must include at least one)', type: [BookingConfigInputDto] })
  @IsArray() @ArrayNotEmpty()
  @ValidateNested({ each: true }) @Type(() => BookingConfigInputDto)
  types!: BookingConfigInputDto[];
}
