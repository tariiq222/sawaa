import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

const DAY_MS = 24 * 60 * 60_000;

/**
 * Default retention windows in days. Each is overridable via the matching
 * env var so PDPL retention policy can be tuned without a deploy.
 *
 * Rows older than the cutoff carry PII (phone numbers, emails, OTP codes,
 * audit metadata) that PDPL requires us to purge once it is no longer needed.
 */
const DEFAULTS = {
  /** OtpCode keyed on expiresAt (one-time codes are useless past expiry). */
  otpDays: 30,
  /** ActivityLog keyed on occurredAt (audit trail kept ~1 year). */
  activityLogDays: 365,
  /** Notification keyed on createdAt. */
  notificationDays: 90,
  /** SmsDelivery keyed on createdAt (DLR records carry recipient phone). */
  smsDeliveryDays: 90,
  /** NotificationDeliveryLog keyed on createdAt. */
  notificationDeliveryLogDays: 90,
} as const;

/**
 * Daily PDPL data-retention sweep. Purges aged PII/log rows from high-churn
 * tables that would otherwise accumulate personal data indefinitely.
 *
 * - Leader-elected via `withCronLeader` (mirrors sibling crons) so only one
 *   instance runs the sweep per tick.
 * - Each table is purged in its own try/catch: a failure on one table (e.g. a
 *   lock contention or transient DB error) is logged and isolated so the
 *   remaining tables are still swept on the same run.
 * - Windows are env-overridable; defaults follow `DEFAULTS` above.
 *
 * NOTE: this is purge-only (deleteMany by date). It does NOT add schema. Full
 * PDPL compliance additionally needs consent capture + data-subject-request
 * (DSR) endpoints, which require schema and are out of scope here.
 */
@Injectable()
export class DataRetentionCron {
  private readonly logger = new Logger(DataRetentionCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async execute(): Promise<void> {
    await withCronLeader(this.prisma, 'data-retention', async () => {
      const now = Date.now();

      const tasks: Array<{ table: string; run: () => Promise<{ count: number }> }> = [
        {
          table: 'OtpCode',
          run: () => {
            const cutoff = new Date(now - this.days('RETENTION_OTP_DAYS', DEFAULTS.otpDays) * DAY_MS);
            return this.prisma.otpCode.deleteMany({ where: { expiresAt: { lt: cutoff } } });
          },
        },
        {
          table: 'ActivityLog',
          run: () => {
            const cutoff = new Date(
              now - this.days('RETENTION_ACTIVITY_LOG_DAYS', DEFAULTS.activityLogDays) * DAY_MS,
            );
            return this.prisma.activityLog.deleteMany({ where: { occurredAt: { lt: cutoff } } });
          },
        },
        {
          table: 'Notification',
          run: () => {
            const cutoff = new Date(
              now - this.days('RETENTION_NOTIFICATION_DAYS', DEFAULTS.notificationDays) * DAY_MS,
            );
            return this.prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } });
          },
        },
        {
          table: 'SmsDelivery',
          run: () => {
            const cutoff = new Date(
              now - this.days('RETENTION_SMS_DELIVERY_DAYS', DEFAULTS.smsDeliveryDays) * DAY_MS,
            );
            return this.prisma.smsDelivery.deleteMany({ where: { createdAt: { lt: cutoff } } });
          },
        },
        {
          table: 'NotificationDeliveryLog',
          run: () => {
            const cutoff = new Date(
              now -
                this.days(
                  'RETENTION_NOTIFICATION_DELIVERY_LOG_DAYS',
                  DEFAULTS.notificationDeliveryLogDays,
                ) *
                  DAY_MS,
            );
            return this.prisma.notificationDeliveryLog.deleteMany({
              where: { createdAt: { lt: cutoff } },
            });
          },
        },
      ];

      let totalDeleted = 0;
      for (const { table, run } of tasks) {
        try {
          const { count } = await run();
          totalDeleted += count;
          this.logger.log(`data-retention: purged ${count} rows from ${table}`);
        } catch (err) {
          // Fail-isolated: one table's failure must not abort the rest.
          this.logger.error(
            `data-retention: failed to purge ${table}`,
            err instanceof Error ? err.stack : err,
          );
        }
      }

      this.logger.log(`data-retention: swept ${tasks.length} tables, ${totalDeleted} rows total`);
    });
  }

  /** Resolve an env-overridable retention window (in days), falling back to the default. */
  private days(envKey: string, fallback: number): number {
    const raw = this.config.get<string>(envKey);
    if (raw === undefined || raw === null || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
