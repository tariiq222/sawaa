import { IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PackageReportType } from './package-reports.handler';

export class PackageReportQueryDto {
  @ApiProperty({
    description: 'Which session-package report to generate',
    enum: PackageReportType,
    example: PackageReportType.SALES,
  })
  @IsEnum(PackageReportType)
  report!: PackageReportType;

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
}
