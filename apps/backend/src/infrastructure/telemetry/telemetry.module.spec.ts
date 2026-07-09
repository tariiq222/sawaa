import { Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppMetricsService } from './app-metrics.service';
import { DbMetricsService } from './db-metrics.service';
import { TelemetryModule } from './telemetry.module';

@Controller('metrics-probe')
class MetricsProbeController {
  constructor(
    private readonly appMetrics: AppMetricsService,
    private readonly dbMetrics: DbMetricsService,
  ) {}

  @Get()
  async metrics(): Promise<string> {
    const [app, db] = await Promise.all([
      this.appMetrics.registry.metrics(),
      this.dbMetrics.registry.metrics(),
    ]);
    return `${app}\n${db}`;
  }
}

@Module({
  imports: [TelemetryModule],
  controllers: [MetricsProbeController],
})
class MetricsProbeModule {}

describe('TelemetryModule', () => {
  it('shares producer metrics with the scrape consumer through exported singletons', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TelemetryModule, MetricsProbeModule],
    }).compile();

    const appMetrics = moduleRef.get(AppMetricsService);
    const dbMetrics = moduleRef.get(DbMetricsService);
    const probe = moduleRef.get(MetricsProbeController);

    appMetrics.httpErrors.labels({ status_class: '5xx' }).inc();
    dbMetrics.tableRowCount.labels({ table: 'Booking' }).set(17);

    await expect(probe.metrics()).resolves.toContain('http_errors_total{status_class="5xx"} 1');
    await expect(probe.metrics()).resolves.toContain('db_table_row_count{table="Booking"} 17');
  });
});
