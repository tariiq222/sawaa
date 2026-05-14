import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProblemReportStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class ListProblemReportsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by report status', enum: ProblemReportStatus, example: ProblemReportStatus.OPEN })
  @IsOptional() @IsEnum(ProblemReportStatus) status?: ProblemReportStatus;
}
