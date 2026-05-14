import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database';
import { BullMqService } from '../../queue/bull-mq.service';
import {
  PLATFORM_MAIL_QUEUE,
  type PlatformMailEnqueuePayload,
  type PlatformMailJobData,
} from './platform-mail-queue.types';

/**
 * Enqueues platform-level transactional emails for delivery via BullMQ
 * with exponential backoff. The queue worker (PlatformMailProcessor)
 * consumes jobs and updates the corresponding PlatformMailDeliveryLog row.
 *
 * Failure mode: enqueue itself never throws — Redis or DB outages must
 * NOT crash the calling cron / billing handler. We log + swallow.
 * Mirrors the ResilientNotificationDispatcher pattern.
 */
@Injectable()
export class PlatformMailQueueService {
  private readonly logger = new Logger(PlatformMailQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bullmq: BullMqService,
  ) {}

  async enqueue(payload: PlatformMailEnqueuePayload): Promise<void> {
    let logId: string | null = null;

    // 1. Create QUEUED log row first so we always have an audit trail,
    //    even if Redis is down.
    try {
      const log = await this.prisma.platformMailDeliveryLog.create({
        data: {
          recipient: payload.recipient,
          templateName: payload.templateName,
          status: 'QUEUED',
          attempt: 0,
        },
      });
      logId = log.id;
    } catch (err) {
      this.logger.error(
        `Failed to create PlatformMailDeliveryLog for ${payload.recipient} (${payload.templateName}) — email NOT queued`,
        err as Error,
      );
      return;
    }

    // 2. Push to BullMQ. If this fails, mark the log row FAILED so the
    //    audit trail reflects reality.
    try {
      const queue = this.bullmq.getQueue(PLATFORM_MAIL_QUEUE);
      const job = await queue.add(
        'send',
        {
          logId,
          recipient: payload.recipient,
          templateName: payload.templateName,
          subject: payload.subject,
          html: payload.html,
          from: payload.from,
        } satisfies PlatformMailJobData,
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 500 },
        },
      );

      await this.prisma.platformMailDeliveryLog.update({
        where: { id: logId },
        data: { jobId: job.id ?? null },
      });

      this.logger.log(
        `Enqueued platform mail: ${payload.templateName} → ${payload.recipient} (log: ${logId}, job: ${job.id ?? 'unknown'})`,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to enqueue platform mail (log: ${logId}): ${errorMessage}`,
      );

      // Best-effort log update; if THIS fails too we have nothing left to do.
      try {
        await this.prisma.platformMailDeliveryLog.update({
          where: { id: logId },
          data: {
            status: 'FAILED',
            errorMessage: `Queue enqueue failed: ${errorMessage}`,
          },
        });
      } catch (updateErr) {
        this.logger.error(
          `Failed to update PlatformMailDeliveryLog after enqueue failure (log: ${logId})`,
          updateErr as Error,
        );
      }
    }
  }
}
