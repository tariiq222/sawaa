import { Module } from '@nestjs/common';
import { AppMetricsService } from './app-metrics.service';
import { DbMetricsService } from './db-metrics.service';

@Module({
  providers: [AppMetricsService, DbMetricsService],
  exports: [AppMetricsService, DbMetricsService],
})
export class TelemetryModule {}
