import { Module, OnModuleInit } from '@nestjs/common';
import { DashboardOpsController } from '../../api/dashboard/ops.controller';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { EmailModule } from '../../infrastructure/email/email.module';
import { BookingsModule } from '../bookings/bookings.module';
import { FinanceModule } from '../finance/finance.module';
import { CronTasksService } from './cron-tasks/cron-tasks.service';
import { BookingAutocompleteCron } from './cron-tasks/booking-autocomplete.cron';
import { BookingExpiryCron } from './cron-tasks/booking-expiry.cron';
import { BookingNoShowCron } from './cron-tasks/booking-noshow.cron';
import { AppointmentRemindersCron } from './cron-tasks/appointment-reminders.cron';
import { GroupSessionAutomationCron } from './cron-tasks/group-session-automation.cron';
import { RefreshTokenCleanupCron } from './cron-tasks/refresh-token-cleanup.cron';
import { DataRetentionCron } from './cron-tasks/data-retention.cron';
import { LogActivityHandler } from './log-activity/log-activity.handler';
import { ListActivityHandler } from './log-activity/list-activity.handler';
import { GenerateReportHandler } from './generate-report/generate-report.handler';
import { HealthCheckHandler } from './health-check/health-check.handler';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { DbRowCountCron } from './cron-tasks/db-row-count.cron';
import { DbMetricsService } from '../../infrastructure/telemetry/db-metrics.service';
import { RunOrphanAuditHandler } from './orphan-audit/run-orphan-audit.handler';

import { ReconcileRefundsCron } from './cron-tasks/reconcile-refunds.cron';
import { OutboxPublisherCron } from './cron-tasks/outbox-publisher.cron';
import { AuthenticaBalanceCheckCron } from './cron-tasks/authentica-balance-check.cron';

const handlers = [
  LogActivityHandler,
  ListActivityHandler,
  GenerateReportHandler,
  HealthCheckHandler,
];

const cronHandlers = [
  BookingAutocompleteCron,
  BookingExpiryCron,
  BookingNoShowCron,
  AppointmentRemindersCron,
  GroupSessionAutomationCron,
  RefreshTokenCleanupCron,
  // PDPL — daily PII/log retention purge
  DataRetentionCron,
  // DB-12/13
  DbRowCountCron,

  // CR-6 — refund reconciliation
  ReconcileRefundsCron,
  // CR-5 — outbox publisher
  OutboxPublisherCron,
  // TAR-83 — Authentica daily balance monitor
  AuthenticaBalanceCheckCron,
];

// FinanceModule is imported to make MoyasarApiClient available to
// ReconcileRefundsCron. MoyasarApiClient is exported by FinanceModule.
@Module({
  imports: [DatabaseModule, MessagingModule, TerminusModule, BookingsModule, FinanceModule, EmailModule],
  controllers: [DashboardOpsController],
  providers: [...handlers, ...cronHandlers, RedisService, CronTasksService, DbMetricsService, RunOrphanAuditHandler],
  exports: [...handlers, RunOrphanAuditHandler, DbMetricsService],
})
export class OpsModule implements OnModuleInit {
  constructor(private readonly cronTasks: CronTasksService) {}

  onModuleInit(): void {
    // CronTasksService.onModuleInit() handles job scheduling + worker registration.
    // Explicitly called here to document the lifecycle dependency.
    void this.cronTasks;
  }
}
