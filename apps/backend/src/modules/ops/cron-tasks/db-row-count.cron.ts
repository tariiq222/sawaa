import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { DbMetricsService } from '../../../infrastructure/telemetry/db-metrics.service';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

/**
 * DB-12 — partition candidate tables.
 * These are append-heavy; row counts drive the partitioning trigger (5M rows).
 * Do NOT add tables here that are not append-only (e.g. User, Organization).
 */
export const PARTITION_CANDIDATES = [
  'Booking',
  'ActivityLog',
  'Notification',
  'NotificationDeliveryLog',
  'SmsDelivery',
  'Payment',
  'DocumentChunk',
] as const;

type PgStatRow = { relname: string; n_live_tup: bigint };

@Injectable()
export class DbRowCountCron {
  private readonly logger = new Logger(DbRowCountCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: DbMetricsService,
  ) {}

  /**
   * Queries pg_stat_user_tables for live row estimates across all partition
   * candidate tables and updates the Prometheus Gauge.
   *
   * pg_stat_user_tables.n_live_tup is an estimate updated by ANALYZE — it is
   * not exact but is sufficient for threshold alerting at 5M rows.
   */
  async execute(): Promise<void> {
    await withCronLeader(this.prisma, 'db-row-count', async () => {
      const tableList = PARTITION_CANDIDATES.map((t) => `'${t}'`).join(', ');

      const rows = await this.prisma.$queryRaw<PgStatRow[]>(
        Prisma.sql`
          SELECT relname, n_live_tup
          FROM pg_stat_user_tables
          WHERE relname IN (${Prisma.raw(tableList)})
        `,
      );

      for (const row of rows) {
        const count = Number(row.n_live_tup);
        this.metrics.tableRowCount.labels({ table: row.relname }).set(count);
        this.logger.debug(`table=${row.relname} rows=${count}`);
      }

      this.logger.log(`DB-12 row-count metrics updated for ${rows.length} tables`);
    });
  }
}
