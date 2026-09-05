import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { Prisma } from '@prisma/client';

import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CaptureReminderNotificationIntentsHandler } from './capture-reminder-notification-intents.handler';
import { NotificationDeliveryPublisher } from './notification-delivery-publisher';
import { NotificationDeliveryWorker } from './notification-delivery-worker';
import {
  NOTIFICATION_OUTBOX_JOB,
  NOTIFICATION_OUTBOX_QUEUE,
  NOTIFICATION_OUTBOX_BACKLOG_WARNING_MS,
  NOTIFICATION_OUTBOX_RECONCILE_INTERVAL_MS,
  NotificationOutboxConfig,
} from './notification-outbox.config';
import { ReconcileNotificationDeliveriesHandler } from './reconcile-notification-deliveries.handler';
import { ReconcileNotificationIntentsHandler } from './reconcile-notification-intents.handler';
import { ReconcileNotificationSourcesHandler } from './reconcile-notification-sources.handler';
import { ReconcileSmsDeliveryReceiptsHandler } from './reconcile-sms-delivery-receipts.handler';
import type { NotificationOutboxTickPort } from './notification-outbox.types';
import type { NotificationOutboxTickResult } from './notification-outbox.types';
import { NotificationOutboxMetrics } from './notification-outbox.metrics';

type DeliveryJob = { deliveryId: string; generation: number };

@Injectable()
export class NotificationOutboxLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxLifecycle.name);
  private timer?: NodeJS.Timeout;
  private activeTick?: Promise<void>;
  private lastBacklogWarningAt = 0;
  private lastBacklogProgressAt = Date.now();
  private previousDue = 0;
  private previousOldestDueCreatedAt?: number;

  constructor(
    private readonly config: NotificationOutboxConfig,
    private readonly bullmq: BullMqService,
    private readonly worker: NotificationDeliveryWorker,
    private readonly sources: ReconcileNotificationSourcesHandler,
    private readonly reminders: CaptureReminderNotificationIntentsHandler,
    private readonly intents: ReconcileNotificationIntentsHandler,
    private readonly deliveries: ReconcileNotificationDeliveriesHandler,
    private readonly receipts: ReconcileSmsDeliveryReceiptsHandler,
    private readonly publisher: NotificationDeliveryPublisher,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly metrics?: NotificationOutboxMetrics,
  ) {}

  onModuleInit(): void {
    if (this.config.deliveryEnabled) {
      const queueWorker = this.bullmq.createWorker<DeliveryJob>(
        NOTIFICATION_OUTBOX_QUEUE,
        async (job: Job<DeliveryJob>) => {
          if (job.name !== NOTIFICATION_OUTBOX_JOB) return;
          await this.worker.process(job.data.deliveryId, job.data.generation);
        },
        { concurrency: 5 },
      );
      queueWorker.on('failed', () => {
        this.logger.error('Notification outbox queue job failed');
      });
    }

    void this.execute();
    this.timer = setInterval(() => void this.execute(), NOTIFICATION_OUTBOX_RECONCILE_INTERVAL_MS);
    this.timer.unref();
  }

  async execute(): Promise<void> {
    if (this.activeTick) return this.activeTick;
    const current = this.runTick().finally(() => {
      if (this.activeTick === current) this.activeTick = undefined;
    });
    this.activeTick = current;
    return current;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.activeTick;
  }

  private async runTick(): Promise<void> {
    let successful = true;
    if (this.config.captureEnabled) {
      successful = this.componentSucceeded(await this.runComponent('sources', this.sources)) && successful;
      successful = this.componentSucceeded(await this.runComponent('reminders', this.reminders)) && successful;
    }
    // Already-owned intents and ambiguous/receipt reconciliation remain DB
    // work even when rollout controls are paused.
    const intents = await this.runComponent('intents', this.intents);
    successful = this.componentSucceeded(intents) && successful;
    const deliveries = await this.runComponent('deliveries', this.deliveries);
    successful = this.componentSucceeded(deliveries) && successful;
    const receipts = await this.runComponent('sms-receipts', this.receipts);
    successful = this.componentSucceeded(receipts) && successful;
    if (this.config.deliveryEnabled) {
      const publisher = await this.runComponent('publisher', this.publisher);
      successful = this.componentSucceeded(publisher) && successful;
    }
    successful = await this.refreshBacklogMetrics() && successful;
    if (successful) this.metrics?.setLastSuccessfulHeartbeat(Date.now() / 1000);
  }

  private componentSucceeded(result: NotificationOutboxTickResult | null): boolean {
    return result !== null && result.failed === 0;
  }

  private async runComponent(
    name: string,
    component: NotificationOutboxTickPort,
  ): Promise<NotificationOutboxTickResult | null> {
    try {
      const result = await component.execute();
      this.metrics?.recordReconciliation(name, result.failed === 0 ? 'success' : 'failure');
      return result;
    } catch {
      this.logger.error(`Notification outbox ${name} reconciliation failed`);
      this.metrics?.recordReconciliation(name, 'failure');
      return null;
    }
  }

  private async refreshBacklogMetrics(): Promise<boolean> {
    if (!this.prisma || !this.metrics) return true;
    try {
      const now = new Date();
      const dueWhere: Prisma.NotificationDeliveryWhereInput = {
        status: { in: ['READY', 'RETRY_WAIT'] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      };
      const [due, oldest] = await Promise.all([
        this.prisma.notificationDelivery.count({ where: dueWhere }),
        this.prisma.notificationDelivery.findFirst({
          where: dueWhere,
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
      ]);
      const oldestCreatedAt = oldest?.createdAt.getTime();
      const oldestAgeMs = oldestCreatedAt ? Math.max(0, Date.now() - oldestCreatedAt) : 0;
      this.metrics.setBacklog(due, oldestAgeMs / 1000);
      const oldestAdvanced =
        oldestCreatedAt !== undefined &&
        this.previousOldestDueCreatedAt !== undefined &&
        oldestCreatedAt > this.previousOldestDueCreatedAt;
      if (due < this.previousDue || due === 0 || oldestAdvanced) {
        this.lastBacklogProgressAt = Date.now();
      }
      this.previousDue = due;
      this.previousOldestDueCreatedAt = oldestCreatedAt;
      if (
        due > 0 &&
        Date.now() - this.lastBacklogProgressAt >= NOTIFICATION_OUTBOX_BACKLOG_WARNING_MS &&
        Date.now() - this.lastBacklogWarningAt >= NOTIFICATION_OUTBOX_BACKLOG_WARNING_MS
      ) {
        this.lastBacklogWarningAt = Date.now();
        this.logger.warn('Notification outbox due backlog has made no progress for two minutes');
      }
      this.metrics.recordReconciliation('backlog-metrics', 'success');
      return true;
    } catch {
      this.logger.error('Notification outbox backlog metrics refresh failed');
      this.metrics.recordReconciliation('backlog-metrics', 'failure');
      return false;
    }
  }
}
