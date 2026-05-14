// BullMQ worker that processes notification-retry jobs.
// Registered once on module init — retries failed CRITICAL channel sends.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import {
  NOTIFICATION_RETRY_QUEUE,
  ResilientNotificationDispatcher,
  type RetryJobData,
} from './resilient-notification-dispatcher.service';
import { ClsService } from 'nestjs-cls';
import { TENANT_CLS_KEY } from '../../../common/constants';

@Injectable()
export class NotificationRetryWorker implements OnModuleInit {
  private readonly logger = new Logger(NotificationRetryWorker.name);

  constructor(
    private readonly bullmq: BullMqService,
    private readonly dispatcher: ResilientNotificationDispatcher,
    private readonly cls: ClsService,
  ) {}

  onModuleInit(): void {
    this.bullmq.createWorker<RetryJobData>(
      NOTIFICATION_RETRY_QUEUE,
      async (job) => {
        const { logId, channel, payload, attempt } = job.data;

        if (!payload?.organizationId) {
          throw new Error(`NotificationRetryWorker: job missing organizationId in payload`);
        }

        await this.cls.run(async () => {
          this.cls.set(TENANT_CLS_KEY, {
            organizationId: payload.organizationId,
            id: '',
            role: '',
            isSuperAdmin: false,
          });

          this.logger.log(
            `Retrying [${channel}] delivery for log ${logId} (attempt #${attempt}, org: ${payload.organizationId})`,
          );
          await this.dispatcher.attemptSend(logId, channel, payload, attempt);
        });
      },
    );
    this.logger.log(`Worker registered for queue: ${NOTIFICATION_RETRY_QUEUE}`);
  }
}
