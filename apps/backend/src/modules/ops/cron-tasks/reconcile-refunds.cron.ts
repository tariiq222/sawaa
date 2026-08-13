import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';
import { RefundPaymentHandler } from '../../finance/refund-payment/refund-payment.handler';

const BATCH_SIZE = 100;

/**
 * Replays stale PROCESSING refunds through the same durable state machine used
 * by the booking-cancellation consumer.
 *
 * Importantly this includes rows whose provider reference is still null: that
 * is the response-lost window, not proof that the provider was never called.
 * RefundPaymentHandler issues POST at most once. A CALL_UNKNOWN row is resolved
 * only with the provider's cumulative refunded amount; an unchanged or partial
 * cumulative amount becomes MANUAL_REVIEW rather than risking a second refund.
 */
@Injectable()
export class ReconcileRefundsCron {
  private readonly logger = new Logger(ReconcileRefundsCron.name);
  private static readonly STALE_THRESHOLD_MS = 15 * 60 * 1_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly refunds: RefundPaymentHandler,
  ) {}

  async execute(): Promise<void> {
    await withCronLeader(this.prisma, 'reconcile-refunds', async () => {
      const cutoff = new Date(Date.now() - ReconcileRefundsCron.STALE_THRESHOLD_MS);
      const rows = await this.prisma.refundRequest.findMany({
        where: {
          status: 'PROCESSING',
          updatedAt: { lt: cutoff },
        },
        select: {
          id: true,
          idempotencyKey: true,
          sourceEventId: true,
          gatewayRef: true,
          providerState: true,
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: BATCH_SIZE,
      });

      if (rows.length === 0) return;
      this.logger.log(`reconcile-refunds: found ${rows.length} stuck row(s)`);

      for (const row of rows) {
        try {
          await this.refunds.finalizeRefundFromCancellation({
            refundRequestId: row.id,
            // Migration backfills this; fallback protects rolling deploys in
            // which the new code can briefly observe a pre-backfill row.
            idempotencyKey: row.idempotencyKey ?? `refund:${row.id}`,
            ...(row.sourceEventId ? { sourceEventId: row.sourceEventId } : {}),
          });
        } catch (error) {
          // One provider outage must not starve unrelated refunds. The handler
          // has already persisted a public-safe retry state; the row remains
          // PROCESSING and the next cron pass retries it.
          this.logger.error(
            `reconcile-refunds: retry failed for RefundRequest ${row.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    });
  }
}
