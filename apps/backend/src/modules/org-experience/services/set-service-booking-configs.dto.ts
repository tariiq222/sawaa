import { ServiceBookingMode } from '@prisma/client';
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

// DB-10: bookingType is now a Prisma enum (ServiceBookingMode).
// Replaces the old 'in_person' | 'online' string literals.

export class BookingConfigInputDto {
  @ApiProperty({
    description: 'Booking delivery mode for this service',
    enum: ServiceBookingMode,
    example: ServiceBookingMode.IN_PERSON,
  })
  @IsEnum(ServiceBookingMode)
  bookingType!: ServiceBookingMode;

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
