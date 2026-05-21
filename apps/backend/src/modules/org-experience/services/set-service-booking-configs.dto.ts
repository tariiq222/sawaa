import { DeliveryType } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  Matches,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const HH_MM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BookingConfigDurationOptionInputDto {
  @ApiPropertyOptional({ description: 'Existing duration option UUID', format: 'uuid' })
  @IsOptional() @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Option label in English', example: '30 min' })
  @IsString() @MaxLength(100)
  label!: string;

  @ApiPropertyOptional({ description: 'Option label in Arabic', example: '٣٠ دقيقة' })
  @IsOptional() @IsString() @MaxLength(100)
  labelAr?: string;

  @ApiProperty({ description: 'Duration in minutes', example: 30 })
  @IsInt() @Min(1)
  durationMins!: number;

  @ApiProperty({ description: 'Price for this duration option', example: 50 })
  @IsNumber() @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'SAR' })
  @IsOptional() @IsString() @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ description: 'Whether this option is the default', example: true })
  @IsOptional() @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Display sort order', example: 0 })
  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether this option is active', example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ServiceAvailabilityWindowInputDto {
  @ApiProperty({ description: 'Day of week, 0=Sunday through 6=Saturday', example: 0 })
  @IsInt() @Min(0) @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ description: 'Window start time in HH:mm', example: '09:00' })
  @Matches(HH_MM_PATTERN)
  startTime!: string;

  @ApiProperty({ description: 'Window end time in HH:mm', example: '17:00' })
  @Matches(HH_MM_PATTERN)
  endTime!: string;

  @ApiPropertyOptional({ description: 'Whether this window is active', example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

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

  @ApiPropertyOptional({ description: 'Use service-specific availability windows instead of only branch hours', example: false })
  @IsOptional() @IsBoolean() useCustomAvailability?: boolean;

  @ApiPropertyOptional({ description: 'Duration options scoped to this delivery channel', type: [BookingConfigDurationOptionInputDto] })
  @IsOptional() @IsArray()
  @ValidateNested({ each: true }) @Type(() => BookingConfigDurationOptionInputDto)
  durationOptions?: BookingConfigDurationOptionInputDto[];

  @ApiPropertyOptional({ description: 'Service custom availability windows scoped to this delivery channel', type: [ServiceAvailabilityWindowInputDto] })
  @IsOptional() @IsArray()
  @ValidateNested({ each: true }) @Type(() => ServiceAvailabilityWindowInputDto)
  availabilityWindows?: ServiceAvailabilityWindowInputDto[];
}

export class SetServiceBookingConfigsDto {
  @ApiProperty({ description: 'Booking type configurations (must include at least one)', type: [BookingConfigInputDto] })
  @IsArray() @ArrayNotEmpty()
  @ValidateNested({ each: true }) @Type(() => BookingConfigInputDto)
  types!: BookingConfigInputDto[];
}
