import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AvailabilityWindow {
  @ApiProperty({ description: 'Day of week (0 = Sunday, 6 = Saturday)', example: 1 })
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;

  @ApiProperty({ description: 'Start time in HH:MM or HH:MM:SS format', example: '09:00' })
  @IsString() @Matches(/^\d{1,2}:\d{2}(:\d{2})?$/) startTime!: string;

  @ApiProperty({ description: 'End time in HH:MM or HH:MM:SS format', example: '17:00' })
  @IsString() @Matches(/^\d{1,2}:\d{2}(:\d{2})?$/) endTime!: string;

  @ApiPropertyOptional({ description: 'Whether this window is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AvailabilityException {
  @ApiProperty({ description: 'Start date of the exception (ISO 8601)', example: '2026-05-01T09:00:00.000Z' })
  @IsDateString() startDate!: string;

  @ApiProperty({ description: 'End date of the exception (ISO 8601)', example: '2026-05-07T09:00:00.000Z' })
  @IsDateString() endDate!: string;

  @ApiPropertyOptional({ description: 'Reason for the exception', example: 'Annual vacation' })
  @IsOptional() @IsString() reason?: string;
}

export class UpdateAvailabilityDto {
  @ApiProperty({ description: 'Weekly availability windows', type: [AvailabilityWindow] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => AvailabilityWindow) windows!: AvailabilityWindow[];

  @ApiPropertyOptional({ description: 'Date-range exceptions (holidays, leave)', type: [AvailabilityException] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AvailabilityException) exceptions?: AvailabilityException[];
}
