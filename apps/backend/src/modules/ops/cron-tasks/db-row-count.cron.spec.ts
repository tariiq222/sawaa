import { DbRowCountCron, PARTITION_CANDIDATES } from './db-row-count.cron';
import { DbMetricsService } from '../../../infrastructure/telemetry/db-metrics.service';

const buildPrisma = () => ({
  $queryRaw: jest.fn()
    .mockResolvedValueOnce([{ v: BigInt(12345) }])
    .mockResolvedValueOnce([{ acquired: true }])
    .mockResolvedValue([
      { relname: 'Booking', n_live_tup: BigInt(1_234_567) },
      { relname: 'ActivityLog', n_live_tup: BigInt(888_000) },
    ]),
});

const buildMetrics = () => {
  const set = jest.fn();
  return {
    tableRowCount: { labels: jest.fn().mockReturnValue({ set }) },
    _set: set,
  } as unknown as DbMetricsService;
};

describe('DbRowCountCron', () => {
  it('queries pg_stat_user_tables for all candidate tables', async () => {
    const prisma = buildPrisma();
    const metrics = buildMetrics();
    const cron = new DbRowCountCron(prisma as never, metrics);
    await cron.execute();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
  });

  it('sets a gauge for each row returned', async () => {
    const prisma = buildPrisma();
    const metrics = buildMetrics();
    const cron = new DbRowCountCron(prisma as never, metrics);
    await cron.execute();
    expect(metrics.tableRowCount.labels).toHaveBeenCalledWith({ table: 'Booking' });
    expect(metrics.tableRowCount.labels).toHaveBeenCalledWith({ table: 'ActivityLog' });
  });

  it('PARTITION_CANDIDATES contains all 7 expected tables', () => {
    expect(PARTITION_CANDIDATES).toContain('Booking');
    expect(PARTITION_CANDIDATES).toContain('ActivityLog');
    expect(PARTITION_CANDIDATES).toContain('Notification');
    expect(PARTITION_CANDIDATES).toContain('NotificationDeliveryLog');
    expect(PARTITION_CANDIDATES).toContain('SmsDelivery');
    expect(PARTITION_CANDIDATES).toContain('Payment');
    expect(PARTITION_CANDIDATES).toContain('DocumentChunk');
    expect(PARTITION_CANDIDATES).toHaveLength(7);
  });
});
