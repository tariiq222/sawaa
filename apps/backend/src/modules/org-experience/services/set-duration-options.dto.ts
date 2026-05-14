import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DurationOptionInputDto {
  @ApiPropertyOptional({ description: 'Existing duration option UUID (for updates)', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional() @IsUUID() id?: string;

  @ApiPropertyOptional({ description: 'Booking type this option applies to', enum: BookingType, example: BookingType.INDIVIDUAL, nullable: true })
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType | null;

  @ApiProperty({ description: 'Option label in English', example: '30 min' })
  @IsString() @MaxLength(100) label!: string;

  @ApiProperty({ description: 'Option label in Arabic', example: '30 دقيقة' })
  @IsString() @MaxLength(100) labelAr!: string;

  @ApiProperty({ description: 'Duration in minutes', example: 30 })
  @IsInt() @Min(1) durationMins!: number;

  @ApiProperty({ description: 'Price for this duration', example: 50 })
  @IsNumber() @Min(0) price!: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'SAR' })
  @IsOptional() @IsString() @MaxLength(8) currency?: string;

  @ApiPropertyOptional({ description: 'Whether this is the default option', example: true })
  @IsOptional() @IsBoolean() isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Display sort order (0-based)', example: 0 })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether this option is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetDurationOptionsDto {
  @ApiProperty({ description: 'Duration options to set (at least one required)', type: [DurationOptionInputDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => DurationOptionInputDto)
  options!: DurationOptionInputDto[];
}
