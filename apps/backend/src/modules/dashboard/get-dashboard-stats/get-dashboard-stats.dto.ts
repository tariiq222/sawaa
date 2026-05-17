import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class GetDashboardStatsDto {
  @ApiPropertyOptional({
    description: 'Range start date (inclusive), yyyy-MM-dd. Defaults to today.',
    example: '2026-05-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be yyyy-MM-dd' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Range end date (inclusive), yyyy-MM-dd. Defaults to the from date.',
    example: '2026-05-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be yyyy-MM-dd' })
  to?: string;
}
