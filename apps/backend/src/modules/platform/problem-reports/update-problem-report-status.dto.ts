import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProblemReportStatus } from '@prisma/client';

export class UpdateProblemReportStatusDto {
  @ApiProperty({ description: 'New status for the problem report', enum: ProblemReportStatus, example: ProblemReportStatus.RESOLVED })
  @IsEnum(ProblemReportStatus) status!: ProblemReportStatus;

  @ApiPropertyOptional({ description: 'Optional resolution note explaining how the problem was addressed', example: 'Fixed in v1.4.2 — invalid form state was not cleared on re-render.' })
  @IsOptional() @IsString() resolution?: string;
}
