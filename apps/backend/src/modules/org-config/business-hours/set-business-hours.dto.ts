import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BusinessHourSlotDto {
  @ApiProperty({ description: 'Day of week (0 = Sunday, 6 = Saturday)', example: 1 })
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;

  @ApiProperty({ description: 'Opening time in HH:mm format', example: '09:00' })
  @IsString() @Matches(TIME_REGEX, { message: 'startTime must be HH:mm' }) startTime!: string;

  @ApiProperty({ description: 'Closing time in HH:mm format', example: '17:00' })
  @IsString() @Matches(TIME_REGEX, { message: 'endTime must be HH:mm' }) endTime!: string;

  @ApiProperty({ description: 'Whether the branch is open on this day', example: true })
  @IsBoolean() isOpen!: boolean;
}

export class SetBusinessHoursDto {
  @ApiProperty({ description: 'ID of the branch to configure', example: 'main-branch' })
  @IsString() branchId!: string;

  @ApiProperty({
    description: 'Weekly schedule — 1 to 7 slots, one per day',
    type: [BusinessHourSlotDto],
  })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7)
  @ValidateNested({ each: true }) @Type(() => BusinessHourSlotDto)
  schedule!: BusinessHourSlotDto[];
}
