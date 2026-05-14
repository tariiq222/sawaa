import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../database';
import { BullMqService } from '../../queue/bull-mq.service';
import { ResendSenderService } from './resend-sender.service';
import {
  PLATFORM_MAIL_QUEUE,
  type PlatformMailJobData,
} from './platform-mail-queue.types';

/**
 * BullMQ worker for the `platform-mail` queue.
 *
 * On each job:
 *   - Increment + record `attempt` from `job.attemptsMade + 1`
 *   - Call ResendSenderService.send(...)
 *   - On success → update log status=SENT, sentAt=now
 *   - On failure → update log status=FAILED, errorMessage, then RETHROW so
 *     BullMQ schedules the next retry per the queue's exponential backoff.
 */
@Injectable()
export class PlatformMailProcessor implements OnModuleInit {
  private readonly logger = new Logger(PlatformMailProcessor.name);

  constructor(
    private readonly bullmq: BullMqService,
    private readonly prisma: PrismaService,
    private readonly sender: ResendSenderService,
  ) {}

  onModuleInit(): void {
    this.bullmq.createWorker<PlatformMailJobData>(
      PLATFORM_MAIL_QUEUE,
      async (job) => this.process(job),
    );
    this.logger.log(`Worker registered for queue: ${PLATFORM_MAIL_QUEUE}`);
  }

  /** Exposed for direct unit testing. */
  async process(job: Job<PlatformMailJobData>): Promise<void> {
    const { logId, recipient, templateName, subject, html, from } = job.data;
    const attempt = job.attemptsMade + 1;

    try {
      await this.sender.send({ to: recipient, from, subject, html });

      await this.prisma.platformMailDeliveryLog.update({
        where: { id: logId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          attempt,
          errorMessage: null,
        },
      });

      this.logger.log(
        `Sent platform mail: ${templateName} → ${recipient} (log: ${logId}, attempt: ${attempt})`,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.logger.warn(
        `Platform mail attempt #${attempt} failed for ${recipient} (${templateName}): ${errorMessage}`,
      );

      try {
        await this.prisma.platformMailDeliveryLog.update({
          where: { id: logId },
          data: {
            status: 'FAILED',
            errorMessage,
            attempt,
          },
        });
      } catch (updateErr) {
        this.logger.error(
          `Failed to update PlatformMailDeliveryLog after send failure (log: ${logId})`,
          updateErr as Error,
        );
      }

      // Re-throw so BullMQ schedules the next attempt per queue backoff.
      throw err;
    }
  }
}
