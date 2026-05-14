import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportFormat, ReportType } from '@prisma/client';

export class GenerateReportDto {
  @ApiProperty({
    description: 'Type of report to generate',
    enum: ReportType,
    example: ReportType.REVENUE,
  })
  @IsEnum(ReportType)
  type!: ReportType;

  @ApiPropertyOptional({
    description: 'Output format — defaults to JSON when omitted',
    enum: ReportFormat,
    example: ReportFormat.EXCEL,
  })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @ApiProperty({
    description: 'Start of reporting period (ISO 8601 date string)',
    example: '2026-01-01',
  })
  @IsDateString()
  from!: string;

  @ApiProperty({
    description: 'End of reporting period (ISO 8601 date string)',
    example: '2026-03-31',
  })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({
    description: 'Restrict report to a specific branch UUID',
    example: 'b1c2d3e4-f5a6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Restrict report to a specific employee UUID',
    example: 'a9b8c7d6-e5f4-3210-fedc-ba9876543210',
  })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({
    description: 'Identifier of the user who requested the report (for audit purposes)',
    example: 'admin@clinic.com',
  })
  @IsOptional()
  @IsString()
  requestedBy?: string;
}
