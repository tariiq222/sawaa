import { Injectable } from '@nestjs/common';
import { Gauge, Registry } from 'prom-client';

/**
 * Exposes per-table row-count Prometheus metrics.
 * A Gauge (not Counter) because the count can decrease (hard deletes).
 *
 * Metric name: db_table_row_count
 * Labels: table (Postgres table name)
 *
 * DB-12: monitoring layer — no schema changes implied.
 */
@Injectable()
export class DbMetricsService {
  /** Shared Prometheus registry for this process. */
  readonly registry = new Registry();

  readonly tableRowCount = new Gauge({
    name: 'db_table_row_count',
    help: 'Estimated number of live rows per PostgreSQL table (from pg_stat_user_tables)',
    labelNames: ['table'] as const,
    registers: [this.registry],
  });
}
