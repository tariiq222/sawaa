import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { OutboxRetryEventView, toFailedEventView } from './outbox-event.view';

export interface RetryFailedOutboxEventCommand {
  id: string;
}

/**
 * Explicitly re-queues one terminal FAILED OutboxEvent for publishing.
 *
 * The mutation is a single conditional `updateMany` guarded by
 * `status = 'FAILED'`, so it is atomic: two concurrent retries (or a retry
 * racing the cron) can never reset a row twice, and a row can only leave the
 * FAILED state through this transition. 404 when the row does not exist, 409
 * when it exists but is not FAILED (or was concurrently moved out of FAILED) —
 * in every error path nothing is mutated.
 */
@Injectable()
export class RetryFailedOutboxEventHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: RetryFailedOutboxEventCommand): Promise<OutboxRetryEventView> {
    const existing = await this.prisma.outboxEvent.findUnique({
      where: { id: cmd.id },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException('Outbox event not found');
    }
    if (existing.status !== 'FAILED') {
      throw new ConflictException('Outbox event is not in FAILED state');
    }

    const result = await this.prisma.outboxEvent.updateMany({
      where: { id: cmd.id, status: 'FAILED' },
      data: {
        status: 'PENDING',
        attemptCount: 0,
        failedAt: null,
        failureReason: null,
        lockedUntil: null,
        publishedAt: null,
      },
    });

    if (result.count === 0) {
      // Row was concurrently moved out of FAILED between the read and update.
      throw new ConflictException('Outbox event is not in FAILED state');
    }

    const row = await this.prisma.outboxEvent.findUnique({
      where: { id: cmd.id },
      select: {
        id: true,
        eventType: true,
        attemptCount: true,
        createdAt: true,
        failedAt: true,
        failureReason: true,
      },
    });

    if (!row) {
      throw new NotFoundException('Outbox event not found');
    }
    return { ...toFailedEventView(row), status: 'PENDING' };
  }
}
