import { IsEnum, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProblemReportType } from '@prisma/client';

export class CreateProblemReportDto {
  @ApiProperty({ description: 'UUID of the user submitting the report', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID() reporterId!: string;

  @ApiProperty({ description: 'Category of the problem', enum: ProblemReportType, example: ProblemReportType.BUG })
  @IsEnum(ProblemReportType) type!: ProblemReportType;

  @ApiProperty({ description: 'Short descriptive title (min 3 characters)', example: 'Booking page crashes on submit' })
  @IsString() @MinLength(3) title!: string;

  @ApiProperty({ description: 'Detailed description of the problem (min 10 characters)', example: 'When clicking the confirm button on the booking form, the page throws a 500 error.' })
  @IsString() @MinLength(10) description!: string;
}
