import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { BookingAutocompleteCron } from './booking-autocomplete.cron';
import { BookingExpiryCron } from './booking-expiry.cron';
import { BookingNoShowCron } from './booking-noshow.cron';
import { AppointmentRemindersCron } from './appointment-reminders.cron';
import { GroupSessionAutomationCron } from './group-session-automation.cron';
import { RefreshTokenCleanupCron } from './refresh-token-cleanup.cron';
import { DataRetentionCron } from './data-retention.cron';

import { DbRowCountCron } from './db-row-count.cron';
import { RunOrphanAuditHandler } from '../orphan-audit/run-orphan-audit.handler';

import { ReconcileRefundsCron } from './reconcile-refunds.cron';
import { ReconcilePaymentsCron } from './reconcile-payments.cron';
import { OutboxPublisherCron } from './outbox-publisher.cron';
import { AuthenticaBalanceCheckCron } from './authentica-balance-check.cron';
import * as Sentry from '@sentry/node';

const QUEUE_NAME = 'ops-cron';

export const CRON_JOBS = {
  BOOKING_AUTOCOMPLETE: 'booking-autocomplete',
  BOOKING_EXPIRY: 'booking-expiry',
  BOOKING_NOSHOW: 'booking-noshow',
  APPOINTMENT_REMINDERS: 'appointment-reminders',
  GROUP_SESSION_AUTOMATION: 'group-session-automation',
  REFRESH_TOKEN_CLEANUP: 'refresh-token-cleanup',
  DATA_RETENTION: 'data-retention',
  DB_ROW_COUNT: 'db-row-count',
  ORPHAN_AUDIT: 'orphan-audit',

  RECONCILE_REFUNDS: 'reconcile-refunds',
  RECONCILE_PAYMENTS: 'reconcile-payments',
  OUTBOX_PUBLISHER: 'outbox-publisher',
  AUTHENTICA_BALANCE_CHECK: 'authentica-balance-check',
} as const;

@Injectable()
export class CronTasksService implements OnModuleInit {
  private readonly logger = new Logger(CronTasksService.name);
  private readonly ownerAlertEmail: string | undefined;

  constructor(
    private readonly bullMq: BullMqService,
    private readonly config: ConfigService,
    private readonly emailFactory: EmailProviderFactory,
    private readonly bookingAutocomplete: BookingAutocompleteCron,
    private readonly bookingExpiry: BookingExpiryCron,
    private readonly bookingNoShow: BookingNoShowCron,
    private readonly appointmentReminders: AppointmentRemindersCron,
    private readonly groupSessionAutomation: GroupSessionAutomationCron,
    private readonly refreshTokenCleanup: RefreshTokenCleanupCron,
    private readonly dataRetention: DataRetentionCron,
    private readonly dbRowCount: DbRowCountCron,
    private readonly orphanAudit: RunOrphanAuditHandler,

    private readonly reconcileRefunds: ReconcileRefundsCron,
    private readonly reconcilePayments: ReconcilePaymentsCron,
    private readonly outboxPublisher: OutboxPublisherCron,
    private readonly authenticaBalanceCheck: AuthenticaBalanceCheckCron,
  ) {
    this.ownerAlertEmail = this.config.get<string>('OWNER_ALERT_EMAIL');
  }

  onModuleInit(): void {
    this.registerRepeatingJobs();
    this.registerWorker();
  }

  private registerRepeatingJobs(): void {
    const queue = this.bullMq.getQueue(QUEUE_NAME);

    const jobs: Array<{ name: string; cron: string }> = [
      { name: CRON_JOBS.BOOKING_AUTOCOMPLETE, cron: '*/15 * * * *' },
      { name: CRON_JOBS.BOOKING_EXPIRY, cron: '*/10 * * * *' },
      { name: CRON_JOBS.BOOKING_NOSHOW, cron: '*/5 * * * *' },
      { name: CRON_JOBS.APPOINTMENT_REMINDERS, cron: '*/5 * * * *' }, // 5-min slices — must match REMINDER_WINDOW_MINUTES
      { name: CRON_JOBS.GROUP_SESSION_AUTOMATION, cron: '*/30 * * * *' },
      { name: CRON_JOBS.REFRESH_TOKEN_CLEANUP, cron: '0 3 * * *' },
      { name: CRON_JOBS.DATA_RETENTION, cron: '0 3 * * *' }, // daily 03:00 — PDPL PII/log purge
      { name: CRON_JOBS.DB_ROW_COUNT, cron: '0 1 * * 0' }, // weekly Sunday 01:00
      { name: CRON_JOBS.ORPHAN_AUDIT, cron: '0 2 * * 0' }, // weekly Sunday 02:00

      { name: CRON_JOBS.RECONCILE_REFUNDS, cron: '*/15 * * * *' },    // every 15 min
      { name: CRON_JOBS.RECONCILE_PAYMENTS, cron: '*/15 * * * *' },   // every 15 min — catch lost payment webhooks
      { name: CRON_JOBS.OUTBOX_PUBLISHER, cron: '*/1 * * * *' },      // every minute (BullMQ min granularity; real tick is every 5s via worker loop)
      { name: CRON_JOBS.AUTHENTICA_BALANCE_CHECK, cron: '0 8 * * *' }, // daily at 08:00 AST
    ];

    for (const { name, cron } of jobs) {
      queue
        .add(
          name,
          {}, // platform-level cron; no per-org context needed
          {
            repeat: { pattern: cron },
            jobId: `repeat:${name}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
          },
        )
        .catch((err: unknown) =>
          this.logger.error(`Failed to schedule ${name}`, err),
        );
    }

    this.logger.log(`Scheduled ${jobs.length} cron jobs on queue "${QUEUE_NAME}"`);
  }

  private registerWorker(): void {
    const worker = this.bullMq.createWorker<object>(QUEUE_NAME, async (job) => {
      const started = Date.now();
      try {
        switch (job.name) {
          case CRON_JOBS.BOOKING_AUTOCOMPLETE:
            await this.bookingAutocomplete.execute();
            break;
          case CRON_JOBS.BOOKING_EXPIRY:
            await this.bookingExpiry.execute();
            break;
          case CRON_JOBS.BOOKING_NOSHOW:
            await this.bookingNoShow.execute();
            break;
          case CRON_JOBS.APPOINTMENT_REMINDERS:
            await this.appointmentReminders.execute();
            break;
          case CRON_JOBS.GROUP_SESSION_AUTOMATION:
            await this.groupSessionAutomation.execute();
            break;
          case CRON_JOBS.REFRESH_TOKEN_CLEANUP:
            await this.refreshTokenCleanup.execute();
            break;
          case CRON_JOBS.DATA_RETENTION:
            await this.dataRetention.execute();
            break;
          case CRON_JOBS.DB_ROW_COUNT:
            await this.dbRowCount.execute();
            break;
          case CRON_JOBS.ORPHAN_AUDIT:
            await this.orphanAudit.execute();
            break;

          case CRON_JOBS.RECONCILE_REFUNDS:
            await this.reconcileRefunds.execute();
            break;
          case CRON_JOBS.RECONCILE_PAYMENTS:
            await this.reconcilePayments.execute();
            break;
          case CRON_JOBS.OUTBOX_PUBLISHER:
            await this.outboxPublisher.execute();
            break;
          case CRON_JOBS.AUTHENTICA_BALANCE_CHECK:
            await this.authenticaBalanceCheck.execute();
            break;
          default:
            this.logger.warn(`Unknown cron job: ${job.name}`);
            return;
        }
        this.logger.log(`Cron ${job.name} ok in ${Date.now() - started}ms`);
      } catch (err) {
        this.logger.error(
          `Cron ${job.name} failed (attempt ${job.attemptsMade + 1})`,
          err instanceof Error ? err.stack : err,
        );
        throw err; // re-throw so BullMQ records the failure and applies backoff
      }
    });

    worker.on('failed', (job, err) => {
      const exhausted = job ? job.attemptsMade >= (job.opts.attempts ?? 1) : true;
      if (exhausted) {
        const cronName = job?.name ?? 'unknown';
        this.logger.error(
          `Cron ${cronName} EXHAUSTED retries — job ${job?.id} → DLQ`,
          err.stack,
        );
        Sentry.captureException(err, { tags: { cron: cronName, jobId: job?.id ?? 'unknown' } });
        // Best-effort owner alert — must never throw from the failure handler.
        void this.alertOwner(cronName, err);
      }
    });
  }

  /**
   * Best-effort email to the operator when a cron job exhausts its retries.
   * Failures here are swallowed: the alert path must never throw and must
   * never mask the original cron failure that Sentry already captured.
   */
  private async alertOwner(cronName: string, err: Error): Promise<void> {
    if (!this.ownerAlertEmail) return;
    try {
      const adapter = await this.emailFactory.resolve();
      if (!adapter.isAvailable()) return;
      await adapter.sendMail({
        to: this.ownerAlertEmail,
        subject: `تحذير: فشل مهمة مجدولة (${cronName}) · Cron job failed`,
        html: `
          <p dir="rtl">فشلت المهمة المجدولة <strong>${cronName}</strong> بعد استنفاد كل المحاولات.</p>
          <p>Scheduled job <strong>${cronName}</strong> failed after exhausting all retries.</p>
          <pre>${(err.message ?? String(err)).slice(0, 1000)}</pre>
        `,
      });
    } catch (alertErr) {
      this.logger.warn(
        `Failed to send owner alert for cron ${cronName}: ${alertErr instanceof Error ? alertErr.message : String(alertErr)}`,
      );
    }
  }
}
