import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import type { DomainEventEnvelope } from '../../../infrastructure/events/event-bus.service';
import { NoEventConsumersRegisteredError } from '../../../infrastructure/events/event-bus.service';
import { AppMetricsService } from '../../../infrastructure/telemetry/app-metrics.service';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';

/** How many unpublished outbox rows to process per tick. */
const BATCH_SIZE = 50;

/** After this many failed attempts the row is marked terminal (FAILED). */
const MAX_ATTEMPTS = 10;

/**
 * CR-5: Outbox publisher cron.
 *
 * Runs every 5 seconds (registered in CronTasksService).
 * Selects up to BATCH_SIZE OutboxEvent rows where status = PENDING,
 * lockedUntil has expired, and failedAt IS NULL (not yet terminal),
 * forwards each to EventBusService, then stamps publishedAt = now().
 *
 * Failure handling (S2):
 *   On publish error, attemptCount is incremented.
 *   Once attemptCount reaches MAX_ATTEMPTS the row is marked FAILED
 *   (failedAt + failureReason set) and excluded from future polling.
 *
 * At-most-once delivery per tick: if the process crashes between publish and
 * the UPDATE, the row remains unpublished and will be retried on the next
 * tick — giving at-least-once semantics end-to-end.
 */
@Injectable()
export class OutboxPublisherCron {
  private readonly logger = new Logger(OutboxPublisherCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly appMetrics: AppMetricsService,
  ) {}

  async execute(): Promise<void> {
    await this.publishPending();
  }

  private async publishPending(): Promise<void> {
    await withCronLeader(this.prisma, 'outbox-publisher', async () => {
      const BATCH_SIZE_NUM = BATCH_SIZE;

      const now = new Date();
      const lockUntil = new Date(now.getTime() + 30_000);

      // Exclude terminal rows (failedAt IS NOT NULL) from the poll.
      const rows = await this.prisma.$queryRaw<{ id: string; eventType: string; payload: unknown; attemptCount: number }[]>`
        SELECT id, "eventType", "payload", "attemptCount" FROM "OutboxEvent"
        WHERE status = 'PENDING'
        AND ("lockedUntil" IS NULL OR "lockedUntil" < ${now})
        AND "failedAt" IS NULL
        ORDER BY "createdAt" ASC
        LIMIT ${BATCH_SIZE_NUM}
        FOR UPDATE SKIP LOCKED
      `;

      if (rows.length === 0) return;

      const rowIds = rows.map((r) => r.id);
      await this.prisma.$executeRaw`
        UPDATE "OutboxEvent"
        SET "lockedUntil" = ${lockUntil}
        WHERE id = ANY(${rowIds}::uuid[])
      `;

      const publishedIds: string[] = [];

      for (const row of rows) {
        try {
          await this.eventBus.publish(
            row.eventType,
            row.payload as unknown as DomainEventEnvelope,
          );
          publishedIds.push(row.id);
        } catch (err) {
          if (err instanceof NoEventConsumersRegisteredError) {
            // Rolling deploy safety: an older process may see an outbox event
            // whose dedicated consumer queue only exists in the newer build.
            // Keep it pending and release the poll lease without burning the
            // finite delivery-attempt budget.
            await this.prisma.outboxEvent.update({
              where: { id: row.id },
              data: { lockedUntil: null },
            });
            this.logger.debug({ eventId: row.id, eventType: row.eventType }, 'outbox event awaits compatible consumer');
            continue;
          }
          const nextAttempt = (row.attemptCount ?? 0) + 1;
          const isTerminal = nextAttempt >= MAX_ATTEMPTS;
          await this.prisma.outboxEvent.update({
            where: { id: row.id },
            data: {
              attemptCount: nextAttempt,
              ...(isTerminal && {
                status: 'FAILED',
                failedAt: new Date(),
                failureReason: (err instanceof Error ? err.message : String(err)).slice(0, 500),
              }),
            },
          });
          // Count only the transition into the terminal FAILED state, and only
          // after the DB update succeeded. Non-terminal retries and rows that
          // are already FAILED (excluded from polling) never reach this point.
          if (isTerminal) {
            this.appMetrics.outboxTerminalFailures
              .labels({ event_type: row.eventType })
              .inc();
          }
          this.logger.warn(
            {
              err: err instanceof Error ? err.message : err,
              eventId: row.id,
              eventType: row.eventType,
              attemptCount: nextAttempt,
              isTerminal,
            },
            isTerminal
              ? 'outbox event reached max attempts — marked FAILED'
              : 'outbox event publish failed — will retry',
          );
        }
      }

      if (publishedIds.length > 0) {
        await this.prisma.outboxEvent.updateMany({
          where: { id: { in: publishedIds } },
          data: { status: 'PUBLISHED', publishedAt: new Date(), lockedUntil: null },
        });
        this.logger.log(`Outbox: published ${publishedIds.length} events`);
      }
    });
  }
}
