import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ActivityAction, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { MoyasarApiClient, MoyasarPaymentStatus } from '../../finance/moyasar-api/moyasar-api.client';
import { PaymentCompletedEvent } from '../../finance/events/payment-completed.event';
import { PaymentFailedEvent } from '../../finance/events/payment-failed.event';
import { DepositPaidEvent } from '../../finance/events/deposit-paid.event';
import { resolveInvoiceDeposit, isDepositPayment } from '../../finance/deposit.helper';
import { AppMetricsService } from '../../../infrastructure/telemetry/app-metrics.service';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';
import { DEFAULT_ORG_ID } from '../../../common/constants';

const CRON_ACTOR_EMAIL = 'system:reconcile-payments-cron';
const BATCH_SIZE = 100;

/**
 * Reconciles ONLINE_CARD Payment rows stuck in PENDING.
 *
 * The Moyasar webhook is the ONLY writer that confirms a card payment. If a
 * webhook is permanently lost (Moyasar exhausts its retries, or every retry
 * hits a transient window), a genuinely-paid card payment stays PENDING
 * forever: the invoice never flips to PAID and the booking never confirms even
 * though the money was collected. The redirect callback is UX-only and is not
 * a reliable fulfillment channel.
 *
 * This cron is the safety net the Moyasar golden rule prescribes
 * ("form → callback → webhook + reconcile"). It polls Moyasar for each stuck
 * row and drives it through the SAME terminal-status logic as the webhook:
 *   - 'paid'/'captured' → COMPLETED + invoice PAID/PARTIALLY_PAID + events
 *   - 'failed'/'voided' → FAILED + PaymentFailedEvent
 *   - anything else     → leave as-is; the user may still be in 3DS
 *
 * It only acts on rows older than a grace window (so it never races a client
 * mid-3DS), only on rows that still carry a Moyasar gatewayRef, and re-reads
 * the row inside the mutation transaction so a webhook that lands first always
 * wins (the cron then no-ops). Event emission is idempotent downstream.
 *
 * Schedule: every 15 minutes (wired in CronTasksService).
 */
@Injectable()
export class ReconcilePaymentsCron {
  private readonly logger = new Logger(ReconcilePaymentsCron.name);

  /** A PENDING card payment is "stuck" only after this grace window — long
   * enough that the client is no longer completing 3DS and a webhook should
   * have arrived. */
  private static readonly STALE_THRESHOLD_MS = 30 * 60 * 1_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly moyasar: MoyasarApiClient,
    @Optional() private readonly appMetrics: AppMetricsService | null = null,
  ) {}

  async execute(): Promise<void> {
    await this.reconcile();
  }

  private async reconcile(): Promise<void> {
    await withCronLeader(this.prisma, 'reconcile-payments', async () => {
      const cutoff = new Date(Date.now() - ReconcilePaymentsCron.STALE_THRESHOLD_MS);

      const stuckRows = await this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.PENDING,
          method: PaymentMethod.ONLINE_CARD,
          updatedAt: { lt: cutoff },
          gatewayRef: { not: null },
        },
        select: {
          id: true,
          invoiceId: true,
          amount: true,
          currency: true,
          gatewayRef: true,
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: BATCH_SIZE,
      });

      if (stuckRows.length === 0) return;

      this.logger.log(`reconcile-payments: found ${stuckRows.length} stuck row(s)`);

      for (const row of stuckRows) {
        const gatewayRef = row.gatewayRef as string;
        try {
          await this.processRow({
            paymentRowId: row.id,
            invoiceId: row.invoiceId,
            rowAmount: Math.round(Number(row.amount)),
            gatewayRef,
          });
        } catch (err) {
          this.logger.error(
            `reconcile-payments: failed to process Payment ${row.id}`,
            err instanceof Error ? err.stack : err,
          );
          // Continue with the next row — one failure must not abort the batch.
        }
      }
    });
  }

  private async processRow(args: {
    paymentRowId: string;
    invoiceId: string;
    rowAmount: number;
    gatewayRef: string;
  }): Promise<void> {
    const { paymentRowId, invoiceId, rowAmount, gatewayRef } = args;

    // Source of truth: re-fetch the authoritative status from Moyasar.
    let fetched: { id: string; status: MoyasarPaymentStatus; amount: number; currency: string };
    try {
      fetched = await this.moyasar.getPaymentStatus(DEFAULT_ORG_ID, gatewayRef);
    } catch (err) {
      if (err instanceof NotFoundException) {
        // Moyasar has no such payment — the gatewayRef is unusable. Leave the
        // row for an operator; retrying will not help.
        this.logger.warn(
          `reconcile-payments: payment ${paymentRowId} not found at Moyasar (gatewayRef=${gatewayRef}) — leaving as-is`,
        );
        return;
      }
      throw err; // transient — surface so the cron retries
    }

    const terminal = this.toTerminalStatus(fetched.status);
    if (terminal === null) {
      this.logger.debug(
        `reconcile-payments: payment ${paymentRowId} not yet terminal (status=${fetched.status}) — skipping`,
      );
      return;
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        total: true,
        currency: true,
        bookingId: true,
        packagePurchaseId: true,
        clientId: true,
      },
    });
    if (!invoice) {
      this.logger.warn(
        `reconcile-payments: payment ${paymentRowId} references unknown invoice ${invoiceId} — leaving as-is`,
      );
      return;
    }

    if (terminal === PaymentStatus.COMPLETED) {
      // Anti-anomaly: the row was created for the outstanding balance at init
      // time, so Moyasar's figure must match it. A mismatch is unexpected —
      // refuse to auto-finalize and leave it for manual review.
      if (fetched.amount !== rowAmount) {
        this.logger.error(
          `reconcile-payments: amount mismatch for payment ${paymentRowId} ` +
            `(row=${rowAmount} fetched=${fetched.amount}) — leaving for manual review`,
        );
        return;
      }
      await this.finalizeCompleted({ paymentRowId, invoice, amountHalalas: fetched.amount });
    } else {
      await this.finalizeFailed({ paymentRowId, invoice, amountHalalas: fetched.amount });
    }
  }

  private async finalizeCompleted(args: {
    paymentRowId: string;
    invoice: {
      id: string;
      total: unknown;
      currency: string;
      bookingId: string | null;
      packagePurchaseId: string | null;
      clientId: string;
    };
    amountHalalas: number;
  }): Promise<void> {
    const { paymentRowId, invoice, amountHalalas } = args;

    // Read the deposit config once (read-only) so a deposit-sized payment can
    // emit DepositPaidEvent instead of confirming the booking.
    const deposit = await resolveInvoiceDeposit(this.prisma, invoice.bookingId);
    const total = Math.round(Number(invoice.total));

    let applied = false;
    let fullyPaid = false;
    let paidAfterWrite = 0;

    await this.rlsTransaction.withTransaction(async (tx) => {
      // Re-read inside the tx: if a webhook already finalized this row, no-op.
      const current = await tx.payment.findUnique({
        where: { id: paymentRowId },
        select: { status: true },
      });
      if (!current || current.status !== PaymentStatus.PENDING) {
        return;
      }

      await tx.payment.update({
        where: { id: paymentRowId },
        data: { status: PaymentStatus.COMPLETED, processedAt: new Date() },
      });

      // Re-aggregate COMPLETED payments AFTER the write and derive the invoice
      // status — a top-up that only covers part of the balance lands
      // PARTIALLY_PAID, not PAID. Mirrors the webhook + ProcessPaymentHandler.
      const agg = await tx.payment.aggregate({
        where: { invoiceId: invoice.id, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      });
      paidAfterWrite = Number(agg._sum?.amount ?? 0);
      fullyPaid = paidAfterWrite >= total;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: fullyPaid ? new Date() : undefined,
        },
      });

      await tx.activityLog.create({
        data: {
          userEmail: CRON_ACTOR_EMAIL,
          action: ActivityAction.SYSTEM,
          entity: 'Payment',
          entityId: paymentRowId,
          description: `Reconciled from Moyasar → COMPLETED (invoice ${invoice.id} ${fullyPaid ? 'PAID' : 'PARTIALLY_PAID'})`,
        },
      });

      // P1-12: stage the domain event in the OutboxEvent table INSIDE this same
      // transaction instead of publishing after commit. The old code awaited
      // eventBus.publish() AFTER the tx committed — if the process crashed in
      // that window, the event was lost: the payment was COMPLETED and the
      // invoice PAID, but the booking never confirmed and no receipt was sent.
      // The reconcile cron is itself the rescue for stuck PENDING rows, so it
      // re-reads the row each tick and no-ops once finalized — meaning a lost
      // post-commit event could NEVER be re-emitted. Staging it atomically lets
      // the OutboxPublisherCron guarantee at-least-once delivery.
      //
      // PaymentCompletedEvent confirms the booking ONLY when the invoice is
      // fully PAID; a deposit-sized partial stages DepositPaidEvent instead.
      if (fullyPaid) {
        const event = new PaymentCompletedEvent({
          paymentId: paymentRowId,
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          packagePurchaseId: invoice.packagePurchaseId,
          amount: amountHalalas,
          currency: invoice.currency,
          organizationId: DEFAULT_ORG_ID,
        });
        await tx.outboxEvent.create({
          data: {
            aggregateId: invoice.id,
            eventType: event.eventName,
            payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
          },
        });
      } else if (
        isDepositPayment({
          paidAfter: paidAfterWrite,
          total,
          depositAmount: deposit.enabled ? deposit.depositAmount : null,
        })
      ) {
        const event = new DepositPaidEvent({
          paymentId: paymentRowId,
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          amount: amountHalalas,
          currency: invoice.currency,
          organizationId: DEFAULT_ORG_ID,
        });
        await tx.outboxEvent.create({
          data: {
            aggregateId: invoice.id,
            eventType: event.eventName,
            payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
          },
        });
      }

      applied = true;
    });

    if (!applied) {
      this.logger.debug(
        `reconcile-payments: payment ${paymentRowId} already finalized by another writer — skipping`,
      );
      return;
    }

    this.appMetrics?.paymentAttempts.labels({ result: 'succeeded' }).inc();

    this.logger.log(
      `reconcile-payments: Payment ${paymentRowId} → COMPLETED (reconciled from Moyasar 'paid', invoice ${fullyPaid ? 'PAID' : 'PARTIALLY_PAID'})`,
    );
  }

  private async finalizeFailed(args: {
    paymentRowId: string;
    invoice: { id: string; currency: string; clientId: string };
    amountHalalas: number;
  }): Promise<void> {
    const { paymentRowId, invoice, amountHalalas } = args;

    let applied = false;
    await this.rlsTransaction.withTransaction(async (tx) => {
      const current = await tx.payment.findUnique({
        where: { id: paymentRowId },
        select: { status: true },
      });
      if (!current || current.status !== PaymentStatus.PENDING) {
        return;
      }
      await tx.payment.update({
        where: { id: paymentRowId },
        data: { status: PaymentStatus.FAILED, failureReason: 'Reconciled from Moyasar (failed/voided)' },
      });
      await tx.activityLog.create({
        data: {
          userEmail: CRON_ACTOR_EMAIL,
          action: ActivityAction.SYSTEM,
          entity: 'Payment',
          entityId: paymentRowId,
          description: `Reconciled from Moyasar → FAILED (invoice ${invoice.id})`,
        },
      });

      // P1-12: stage PaymentFailedEvent in the outbox INSIDE the tx (see
      // finalizeCompleted) so a crash between commit and publish cannot lose it
      // — the OutboxPublisherCron delivers it at-least-once.
      const event = new PaymentFailedEvent({
        paymentId: paymentRowId,
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        amount: amountHalalas,
        currency: invoice.currency,
        reason: 'Reconciled from Moyasar (failed/voided)',
      });
      await tx.outboxEvent.create({
        data: {
          aggregateId: invoice.id,
          eventType: event.eventName,
          payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
        },
      });

      applied = true;
    });

    if (!applied) return;

    this.appMetrics?.paymentAttempts.labels({ result: 'failed' }).inc();

    this.logger.warn(
      `reconcile-payments: Payment ${paymentRowId} → FAILED (reconciled from Moyasar failed/voided)`,
    );
  }

  /**
   * Maps an authoritative Moyasar status to the internal terminal PaymentStatus.
   * Returns `null` when the payment is not yet terminal — leave it for a later
   * poll. `refunded` is intentionally treated as non-terminal here (a PENDING
   * row should never be refunded; the REFUNDED lifecycle is owned elsewhere).
   */
  private toTerminalStatus(status: MoyasarPaymentStatus): PaymentStatus | null {
    switch (status) {
      case 'paid':
      case 'captured':
        return PaymentStatus.COMPLETED;
      case 'failed':
      case 'voided':
        return PaymentStatus.FAILED;
      default:
        return null;
    }
  }
}
