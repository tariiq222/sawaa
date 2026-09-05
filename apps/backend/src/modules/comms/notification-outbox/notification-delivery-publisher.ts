import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  NOTIFICATION_OUTBOX_BATCH_SIZE,
  NOTIFICATION_OUTBOX_JOB,
  NOTIFICATION_OUTBOX_QUEUE,
} from './notification-outbox.config';
import { NotificationOutboxConfig } from './notification-outbox.config';
import type { NotificationOutboxTickResult } from './notification-outbox.types';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NotificationOutboxMetrics } from './notification-outbox.metrics';

type ClaimedEnqueue = { id: string; enqueueGeneration: number };

@Injectable()
export class NotificationDeliveryPublisher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bullmq: BullMqService,
    private readonly config: NotificationOutboxConfig,
    @Optional() private readonly metrics?: NotificationOutboxMetrics,
  ) {}

  async execute(): Promise<NotificationOutboxTickResult> {
    if (!this.config.deliveryEnabled) {
      return { examined: 0, changed: 0, failed: 0 };
    }

    const queue = this.bullmq.getQueue(NOTIFICATION_OUTBOX_QUEUE);
    const candidates = await this.prisma.notificationDelivery.findMany({
      where: {
        status: { in: ['READY', 'RETRY_WAIT'] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        AND: [{ OR: [{ nextEnqueueAt: null }, { nextEnqueueAt: { lte: new Date() } }] }],
      },
      orderBy: [{ nextEnqueueAt: 'asc' }, { id: 'asc' }],
      take: NOTIFICATION_OUTBOX_BATCH_SIZE,
      select: { id: true, enqueueGeneration: true },
    });

    const claimable: string[] = [];
    for (const candidate of candidates) {
      try {
        const existing = await queue.getJob(`${candidate.id}-${candidate.enqueueGeneration}`);
        const state = existing ? await existing.getState() : 'unknown';
        if (state === 'waiting' || state === 'delayed' || state === 'active') continue;
      } catch {
        // Redis availability is proven again by queue.add below. Keeping the
        // database row claimable preserves durable recovery when Redis is down.
      }
      claimable.push(candidate.id);
    }
    if (claimable.length === 0) {
      return { examined: candidates.length, changed: 0, failed: 0 };
    }

    // The final due check, row lock, generation bump, and enqueue-window claim
    // remain one atomic database statement. Redis inspection only prevents a
    // known-live prior generation from being starved.
    const claimed = (await this.prisma.$queryRaw`
      WITH due AS (
        SELECT "id"
        FROM "NotificationDelivery"
        WHERE "id" IN (${Prisma.join(claimable)})
          AND "status" IN ('READY', 'RETRY_WAIT')
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
          AND ("nextEnqueueAt" IS NULL OR "nextEnqueueAt" <= NOW())
        ORDER BY "nextEnqueueAt" ASC NULLS FIRST, "id" ASC
        LIMIT ${NOTIFICATION_OUTBOX_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "NotificationDelivery" AS delivery
      SET "nextEnqueueAt" = NOW() + INTERVAL '15 seconds',
          "enqueueGeneration" = delivery."enqueueGeneration" + 1,
          "updatedAt" = NOW()
      FROM due
      WHERE delivery."id" = due."id"
      RETURNING delivery."id", delivery."enqueueGeneration"
    `) as unknown as ClaimedEnqueue[];

    let changed = 0;
    let failed = 0;
    for (const row of claimed) {
      try {
        await queue.add(
          NOTIFICATION_OUTBOX_JOB,
          { deliveryId: row.id, generation: row.enqueueGeneration },
          { jobId: `${row.id}-${row.enqueueGeneration}`, attempts: 1 },
        );
        changed += 1;
      } catch {
        // The claimed row remains recoverable through nextEnqueueAt. Provider
        // attempts are only incremented by the worker after a lease claim.
        failed += 1;
        this.metrics?.recordEnqueueFailure();
      }
    }
    return { examined: candidates.length, changed, failed };
  }
}
