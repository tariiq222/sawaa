import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

export class BreakWindowDto {
  @ApiProperty({ description: 'Day of week (0 = Sunday, 6 = Saturday)', example: 1 })
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;

  @ApiProperty({ description: 'Break start time (HH:MM)', example: '12:00' })
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;

  @ApiProperty({ description: 'Break end time (HH:MM)', example: '13:00' })
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
}

export class SetEmployeeBreaksDto {
  @ApiProperty({ description: 'Break windows to set', type: [BreakWindowDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => BreakWindowDto)
  breaks!: BreakWindowDto[];
}
