import { Injectable, Logger } from '@nestjs/common';
import { ActivityAction } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { MoyasarApiClient } from '../../finance/moyasar-api/moyasar-api.client';
import { computeRefundAccounting } from '../../finance/refund-payment/refund-vat.helper';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';
import { DEFAULT_ORG_ID } from '../../../common/constants';

const CRON_ACTOR_EMAIL = 'system:reconcile-refunds-cron';
const BATCH_SIZE = 100;

/**
 * Reconciles RefundRequest rows that are stuck in PROCESSING.
 *
 * A row lands in PROCESSING when:
 *   1. Moyasar accepted the refund (money moved), AND
 *   2. Our finalize DB transaction failed (or the process crashed).
 *
 * This cron polls Moyasar for each stuck row and:
 *   - 'paid'    → flip RefundRequest to COMPLETED + Payment to REFUNDED + Invoice to REFUNDED
 *   - 'failed'  → flip RefundRequest to FAILED
 *   - 'pending' → leave as-is; Moyasar is still processing
 *
 * Rows with no gatewayRef are skipped — they have no Moyasar refund to query.
 *
 * Schedule: every 15 minutes (wired in CronTasksService).
 */
@Injectable()
export class ReconcileRefundsCron {
  private readonly logger = new Logger(ReconcileRefundsCron.name);

  /** A row is considered "stuck" if it has been in PROCESSING for more than 15 min. */
  private static readonly STALE_THRESHOLD_MS = 15 * 60 * 1_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly moyasar: MoyasarApiClient,
  ) {}

  async execute(): Promise<void> {
    await this.reconcile();
  }

  private async reconcile(): Promise<void> {
    await withCronLeader(this.prisma, 'reconcile-refunds', async () => {
      const cutoff = new Date(Date.now() - ReconcileRefundsCron.STALE_THRESHOLD_MS);

      const stuckRows = await this.prisma.refundRequest.findMany({
        where: {
          status: 'PROCESSING',
          updatedAt: { lt: cutoff },
          gatewayRef: { not: null },
        },
        select: {
          id: true,
          paymentId: true,
          invoiceId: true,
          gatewayRef: true,
          amount: true,
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: BATCH_SIZE,
      });

      if (stuckRows.length === 0) return;

      this.logger.log(`reconcile-refunds: found ${stuckRows.length} stuck row(s)`);

      for (const row of stuckRows) {
        // gatewayRef is guaranteed non-null by the query filter above
        const gatewayRef = row.gatewayRef as string;
        try {
          await this.processRow(
            row.id,
            DEFAULT_ORG_ID,
            row.paymentId,
            row.invoiceId,
            gatewayRef,
            Math.round(Number(row.amount)),
          );
        } catch (err) {
          this.logger.error(
            `reconcile-refunds: failed to process RefundRequest ${row.id}`,
            err instanceof Error ? err.stack : err,
          );
          // Continue with next row — don't let one failure abort the whole batch.
        }
      }
    });
  }

  private async processRow(
    refundRequestId: string,
    organizationId: string,
    paymentId: string,
    invoiceId: string,
    gatewayRef: string,
    refundAmount: number,
  ): Promise<void> {
    const { status } = await this.moyasar.getRefundStatus(organizationId, gatewayRef);

    if (status === 'pending') {
      this.logger.debug(
        `reconcile-refunds: RefundRequest ${refundRequestId} still pending at Moyasar — skipping`,
      );
      return;
    }

    if (status === 'failed') {
      await this.rlsTransaction.withTransaction(async (tx) => {
        await tx.refundRequest.update({
          where: { id: refundRequestId },
          data: { status: 'FAILED' },
        });
        await tx.activityLog.create({
          data: {
            userEmail: CRON_ACTOR_EMAIL,
            action: ActivityAction.SYSTEM,
            entity: 'RefundRequest',
            entityId: refundRequestId,
            description: 'Reconciled from Moyasar → FAILED',
          },
        });
      });
      this.logger.warn(
        `reconcile-refunds: RefundRequest ${refundRequestId} → FAILED (Moyasar reported failure)`,
      );
      return;
    }

    // status === 'paid' — finalize atomically.
    //
    // Mirror ApproveRefundHandler's accounting EXACTLY: a partial refund must
    // land PARTIALLY_REFUNDED with the ledger columns (refundedAmount /
    // refundedVatAmt) incremented — never force a blanket REFUNDED, which would
    // hide remaining refundable balance and leave the columns stale. The row is
    // still PROCESSING here, so this refund has NOT yet been applied to the
    // invoice/payment (the approve transaction never committed) — apply it once.
    if (status === 'paid') {
      const newStatus = await this.rlsTransaction.withTransaction(async (tx) => {
        const invoiceForAccounting = await tx.invoice.findUniqueOrThrow({
          where: { id: invoiceId },
          select: { total: true, vatAmt: true, refundedAmount: true },
        });
        const accounting = computeRefundAccounting({
          invoiceTotal: invoiceForAccounting.total,
          invoiceVatAmt: invoiceForAccounting.vatAmt,
          alreadyRefundedAmount: invoiceForAccounting.refundedAmount,
          thisRefundAmount: refundAmount,
        });

        await tx.refundRequest.update({
          where: { id: refundRequestId },
          data: { status: 'COMPLETED' },
        });
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: accounting.newInvoiceStatus,
            refundedAmount: accounting.newRefundedAmount,
            refundedVatAmt: accounting.newRefundedVatAmt,
          },
        });
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: accounting.newInvoiceStatus === 'REFUNDED' ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            refundedAmount: { increment: refundAmount },
          },
        });
        await tx.activityLog.create({
          data: {
            userEmail: CRON_ACTOR_EMAIL,
            action: ActivityAction.SYSTEM,
            entity: 'RefundRequest',
            entityId: refundRequestId,
            description: `Reconciled from Moyasar → COMPLETED (${accounting.newInvoiceStatus}, amount=${refundAmount} payment=${paymentId} invoice=${invoiceId})`,
          },
        });
        return accounting.newInvoiceStatus;
      });
      this.logger.log(
        `reconcile-refunds: RefundRequest ${refundRequestId} → COMPLETED ` +
          `(reconciled from Moyasar 'paid', invoice ${newStatus})`,
      );
    }
  }
}
