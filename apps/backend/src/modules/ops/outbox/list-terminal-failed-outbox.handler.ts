import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { OutboxFailedEventView, toFailedEventView } from './outbox-event.view';

/** Default page size for the failed-outbox listing. */
export const DEFAULT_FAILED_OUTBOX_LIMIT = 50;

/** Hard cap enforced by the handler as a second line of defense (DTO caps at 100). */
export const MAX_FAILED_OUTBOX_LIMIT = 100;

export interface ListTerminalFailedOutboxQuery {
  limit?: number;
  eventType?: string;
}

/**
 * Lists OutboxEvent rows in the terminal FAILED state.
 *
 * Only metadata is selected — `payload` is never queried or returned.
 * `failureReason` is sanitized/truncated via the shared view mapper.
 */
@Injectable()
export class ListTerminalFailedOutboxHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListTerminalFailedOutboxQuery): Promise<{ items: OutboxFailedEventView[] }> {
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_FAILED_OUTBOX_LIMIT, 1),
      MAX_FAILED_OUTBOX_LIMIT,
    );

    const rows = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'FAILED',
        ...(query.eventType ? { eventType: query.eventType } : {}),
      },
      select: {
        id: true,
        eventType: true,
        attemptCount: true,
        createdAt: true,
        failedAt: true,
        failureReason: true,
      },
      orderBy: { failedAt: 'desc' },
      take: limit,
    });

    return { items: rows.map(toFailedEventView) };
  }
}
