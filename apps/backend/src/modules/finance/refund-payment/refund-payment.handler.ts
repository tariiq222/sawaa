import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PaymentStatus, RefundStatus, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { RefundCompletedEvent } from '../events/refund-completed.event';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import { assertValidTransition } from '../payment-state-machine';
import { computeRefundAccounting } from './refund-vat.helper';
import { decimalToHalalas } from '../money.helper';
import { DEFAULT_ORG_ID } from '../../../common/constants';

const REFUND_PROVIDER_LEASE_MS = 60_000;

/**
 * Money columns are Decimal(12,2) in Postgres holding whole halalas. Prisma
 * surfaces them as Prisma.Decimal; we convert to integer `number` exactly once
 * at the read boundary via decimalToHalalas() so everything downstream is
 * plain integer-halala arithmetic.
 */
interface CreateRefundRequestInTxResult {
  refundRequestId: string;
  idempotencyKey: string;
  payment: {
    id: string;
    /** null for off-gateway (cash/bank-transfer) payments settled in-tx */
    gatewayRef: string | null;
    /** integer halalas (converted from Decimal at the read boundary) */
    amount: number;
    invoice: {
      id: string;
      bookingId: string | null;
      clientId: string;
      currency: string;
    };
  };
}

interface RefundPaymentCommand {
  paymentId: string;
  reason: string;
  amount?: number;
  performedBy?: string;
  /** Stable domain-event identity for queue replay recovery. */
  sourceEventId?: string;
}

/**
 * Single-step refund used by `PATCH /payments/:id/refund` (clinic dashboard).
 *
 * Ordering — CRITICAL for money-safety:
 *   1. Persist a RefundRequest row in PROCESSING before calling Moyasar.
 *   2. Acquire its exclusive DB lease, GET the provider's cumulative refunded
 *      baseline, persist CALL_UNKNOWN + target, then POST exactly once.
 *   3. If the POST outcome is unknown, replay performs GET only. A proven
 *      target finalizes; an unchanged/intermediate amount enters MANUAL_REVIEW.
 *   4. Atomic finalize: flip RefundRequest → COMPLETED + Payment → REFUNDED +
 *      Invoice → REFUNDED in a single transaction. If this transaction fails
 *      after Moyasar succeeded, we keep the gatewayRef on the row and leave
 *      it in PROCESSING for reconciliation.
 */
@Injectable()
export class RefundPaymentHandler {
  private readonly logger = new Logger(RefundPaymentHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    _eventBus: EventBusService,
    private readonly moyasar: MoyasarApiClient,
  ) {}

  /**
   * Fetch a refund request by id. Used by OnBookingCancelledRefundHandler.
   */
  async getRefundRequest(query: { id: string }): Promise<{
    id: string;
    paymentId: string;
    /** integer halalas */
    amount: number;
    status: string;
    gatewayRef: string | null;
  } | null> {
    const row = await this.prisma.refundRequest.findUnique({
      where: query,
      select: { id: true, paymentId: true, amount: true, status: true, gatewayRef: true },
    });
    if (!row) return null;
    return { ...row, amount: decimalToHalalas(row.amount) };
  }

  /**
   * Call Moyasar to create a refund and return the result.
   * Exposed for OnBookingCancelledRefundHandler when refund was pre-created
   * in the cancellation transaction.
   */
  async callMoyasarAndFinalize(
    gatewayRef: string,
    amount: number,
    _requestKey: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    return this.moyasar.createRefund(organizationId, {
      paymentId: gatewayRef,
      amount: Math.round(amount), // already halalas
    });
  }

  /**
   * Phase 3 (finalize) — called by OnBookingCancelledRefundHandler when a
   * refundRequestId is already present on the event (pre-created atomically
   * with the booking cancellation). Updates RefundRequest to COMPLETED,
   * Payment to REFUNDED, and Invoice to REFUNDED in a single transaction.
   */
  async finalizeRefund(
    refundRequestId: string,
    idempotencyKey: string,
    gatewayRef: string,
  ): Promise<void> {
    await this.rlsTransaction.withTransaction(async (tx) => {
      await tx.refundRequest.update({
        where: { id: refundRequestId },
        data: { status: RefundStatus.COMPLETED, gatewayRef },
      });
      const refundReq = await tx.refundRequest.findUniqueOrThrow({
        where: { id: refundRequestId },
        select: { paymentId: true, amount: true, invoiceId: true },
      });
      const currentInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id: refundReq.invoiceId },
        select: { total: true, vatAmt: true, refundedAmount: true },
      });
      const refundAmount = decimalToHalalas(refundReq.amount);
      const accounting = computeRefundAccounting({
        invoiceTotal: currentInvoice.total,
        invoiceVatAmt: currentInvoice.vatAmt,
        alreadyRefundedAmount: currentInvoice.refundedAmount,
        thisRefundAmount: refundAmount,
      });
      // Mirror the invoice's REFUNDED / PARTIALLY_REFUNDED outcome onto the
      // payment so a payment with an outstanding balance can be refunded again.
      const paymentStatus =
        accounting.newInvoiceStatus === 'REFUNDED'
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
      await tx.payment.update({
        where: { id: refundReq.paymentId },
        data: {
          status: paymentStatus,
          failureReason: `Booking cancellation refund (${idempotencyKey})`,
          refundedAmount: { increment: refundAmount },
        },
      });
      await tx.invoice.update({
        where: { id: refundReq.invoiceId },
        data: {
          status: accounting.newInvoiceStatus,
          refundedAmount: accounting.newRefundedAmount,
          refundedVatAmt: accounting.newRefundedVatAmt,
        },
      });
    });
  }

  /**
   * Phase 1 — create RefundRequest in PROCESSING inside a caller-provided transaction.
   * The caller (e.g. CancelBookingHandler) manages the transaction lifecycle and
   * passes the transaction client `tx` directly.
   *
   * Steps:
   *   1. SELECT FOR UPDATE on Payment to prevent concurrent double-refunds
   *   2. Guard against existing in-flight RefundRequest
   *   3. Fetch Invoice for org/client/booking context
   *   4. Build idempotency key: `refund:{paymentId}:{amount.toFixed(2)}`
   *   5. Persist RefundRequest row in PROCESSING
   *   6. Return { refundRequestId, idempotencyKey, payment }
   */
  async createRefundRequestInTx(
    tx: Prisma.TransactionClient,
    cmd: {
      paymentId: string;
      reason: string;
      performedBy?: string;
      amount?: number;
      sourceEventId?: string;
    },
  ): Promise<CreateRefundRequestInTxResult> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        gatewayRef: string | null;
        amount: Prisma.Decimal;
        refundedAmount: Prisma.Decimal | null;
        invoiceId: string;
      }>
    >`SELECT id, status, "gatewayRef", amount, "refundedAmount", "invoiceId"
        FROM "Payment"
        WHERE id = ${cmd.paymentId}
        FOR UPDATE`;

    const row = rows[0];
    if (!row) throw new NotFoundException('Payment not found');
    if (
      row.status !== PaymentStatus.COMPLETED &&
      row.status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException('Only completed or partially-refunded payments can be refunded');
    }
    // The outstanding-balance clamp below is the real guard against over-refund;
    // here we only assert the status is in a refundable state.
    assertValidTransition(row.status as PaymentStatus, PaymentStatus.PARTIALLY_REFUNDED);

    const existingInFlightRefund = await tx.refundRequest.findFirst({
      where: { paymentId: cmd.paymentId, status: RefundStatus.PROCESSING },
      select: { id: true },
    });
    if (existingInFlightRefund) {
      throw new BadRequestException('Payment refund is already processing');
    }

    const isOffGateway = !row.gatewayRef;

    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: row.invoiceId },
      select: {
        id: true,
        bookingId: true,
        clientId: true,
        currency: true,
        // total/vatAmt/refundedAmount only needed for the off-gateway path,
        // where the refund is settled fully inside this transaction.
        total: true,
        vatAmt: true,
        refundedAmount: true,
      },
    });

    // Refund amount (integer halalas). When the caller supplies a partial
    // amount (e.g. a late-cancel honouring lateCancelRefundPercent) we use it
    // instead of the full paid amount, clamped to the outstanding balance so
    // we never over-refund. Math.round guards against any fractional halala
    // sneaking in from the caller's percent math.
    const fullAmount = decimalToHalalas(row.amount);
    const outstanding = fullAmount - decimalToHalalas(row.refundedAmount ?? 0);
    const requestedAmount = cmd.amount === undefined ? fullAmount : Math.round(cmd.amount);
    if (requestedAmount <= 0 || requestedAmount > outstanding) {
      throw new BadRequestException(
        `Refund amount ${requestedAmount} exceeds the refundable balance of ${outstanding} halalas`,
      );
    }
    const refundAmount = requestedAmount;
    const refundRequestId = randomUUID();
    // SECURITY (P1): idempotency key keyed on the unique refundRequestId,
    // NOT on (paymentId, amount). Two legitimate partial refunds of equal
    // amounts on the same payment used to collide on the gateway side —
    // Moyasar would silently return the first refund while the merchant
    // recorded two RefundRequest rows. ApproveRefundHandler already keys on
    // refundRequestId; this aligns both code paths.
    const idempotencyKey = `refund:${refundRequestId}`;

    // P1-1 (money-safety): off-gateway payments (cash/bank-transfer) have NO
    // gatewayRef, so there is no external call to make. Throwing here used to
    // abort the entire cancellation transaction, leaving the booking un-cancelled
    // and the customer with no refund. Instead, settle the refund fully inside
    // THIS transaction (RefundRequest born COMPLETED, Payment + Invoice updated)
    // — mirroring ManualRefundPaymentHandler. The downstream finalize subscriber
    // sees the request already COMPLETED and skips Moyasar entirely.
    if (isOffGateway) {
      const accounting = computeRefundAccounting({
        invoiceTotal: invoice.total,
        invoiceVatAmt: invoice.vatAmt,
        alreadyRefundedAmount: invoice.refundedAmount,
        thisRefundAmount: refundAmount,
      });
      await tx.refundRequest.create({
        data: {
          id: refundRequestId,
          invoiceId: invoice.id,
          paymentId: row.id,
          clientId: invoice.clientId,
          amount: refundAmount,
          reason: cmd.reason,
          status: RefundStatus.COMPLETED,
          processedAt: new Date(),
          processedBy: cmd.performedBy ?? 'system',
          idempotencyKey,
          sourceEventId: cmd.sourceEventId,
          providerState: 'CONFIRMED',
        },
        select: { id: true },
      });
      const paymentStatus =
        accounting.newInvoiceStatus === 'REFUNDED'
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
      await tx.payment.update({
        where: { id: row.id },
        data: {
          status: paymentStatus,
          failureReason: cmd.reason,
          refundedAmount: { increment: refundAmount },
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: accounting.newInvoiceStatus,
          refundedAmount: accounting.newRefundedAmount,
          refundedVatAmt: accounting.newRefundedVatAmt,
        },
      });

      return {
        refundRequestId,
        idempotencyKey,
        payment: {
          id: row.id,
          gatewayRef: null,
          amount: fullAmount,
          invoice,
        },
      };
    }

    await tx.refundRequest.create({
      data: {
        id: refundRequestId,
        invoiceId: invoice.id,
        paymentId: row.id,
        clientId: invoice.clientId,
        amount: refundAmount,
        reason: cmd.reason,
        status: RefundStatus.PROCESSING,
        processedAt: new Date(),
        processedBy: cmd.performedBy ?? 'system',
        idempotencyKey,
        sourceEventId: cmd.sourceEventId,
          providerState: 'BEFORE_CALL',
      },
      select: { id: true },
    });

    return {
      refundRequestId,
      idempotencyKey,
      payment: {
        id: row.id,
        gatewayRef: row.gatewayRef,
        amount: fullAmount,
        invoice,
      },
    };
  }

  /**
   * Phase 3 (finalize) — called by OnBookingCancelledRefundHandler when a
   * RefundRequest was pre-created via createRefundRequestInTx in the
   * cancellation transaction. Calls Moyasar at most once and then
   * atomically updates RefundRequest → COMPLETED, Payment → REFUNDED,
   * Invoice → REFUNDED inside a single RLS transaction.
   */
  async finalizeRefundFromCancellation(
    cmd: { refundRequestId: string; idempotencyKey: string; sourceEventId?: string },
  ): Promise<void> {
    const initial = await this.prisma.refundRequest.findUniqueOrThrow({
      where: { id: cmd.refundRequestId },
      select: {
        id: true,
        paymentId: true,
        amount: true,
        invoiceId: true,
        status: true,
        gatewayRef: true,
        idempotencyKey: true,
        sourceEventId: true,
        providerState: true,
        providerLeaseOwner: true,
        providerLeaseExpiresAt: true,
        baselineRefundedAmount: true,
        targetCumulativeRefundedAmount: true,
        observedCumulativeRefundedAmount: true,
      },
    });

    if (initial.idempotencyKey && initial.idempotencyKey !== cmd.idempotencyKey) {
      throw new ConflictException('Refund idempotency key does not match the durable request');
    }
    if (initial.sourceEventId && cmd.sourceEventId && initial.sourceEventId !== cmd.sourceEventId) {
      throw new ConflictException('Refund request belongs to a different source event');
    }
    if (initial.status === RefundStatus.COMPLETED) {
      this.logger.warn({ refundRequestId: cmd.refundRequestId }, 'refund_already_completed_skipping');
      return;
    }
    if (
      initial.status === RefundStatus.MANUAL_REVIEW
      || (initial.status === RefundStatus.FAILED && initial.providerState === 'FAILED')
    ) {
      this.logger.warn({ refundRequestId: cmd.refundRequestId }, 'refund_provider_failure_already_recorded');
      return;
    }
    if (initial.status !== RefundStatus.PROCESSING) {
      throw new ConflictException(`Refund request is not retryable from status ${initial.status}`);
    }

    const leaseOwner = randomUUID();
    const leaseNow = new Date();
    const leaseExpiresAt = new Date(leaseNow.getTime() + REFUND_PROVIDER_LEASE_MS);
    const acquired = await this.prisma.refundRequest.updateMany({
      where: {
        id: cmd.refundRequestId,
        status: RefundStatus.PROCESSING,
        OR: [
          { providerLeaseOwner: null },
          { providerLeaseExpiresAt: null },
          { providerLeaseExpiresAt: { lt: leaseNow } },
        ],
      },
      data: {
        providerLeaseOwner: leaseOwner,
        providerLeaseExpiresAt: leaseExpiresAt,
        providerAttemptCount: { increment: 1 },
        lastProviderAttemptAt: leaseNow,
      },
    });
    if (acquired.count !== 1) {
      throw new ConflictException('Refund provider lease is already held');
    }

    let primaryError: unknown;
    let paymentLeaseId: string | null = null;
    try {
      // Keep early terminal/manual-review returns scoped to the processing
      // closure so the outer flow always releases the provider lease.
      await (async () => {
      const refundReq = await this.prisma.refundRequest.findUniqueOrThrow({
        where: { id: cmd.refundRequestId },
        select: {
          id: true,
          paymentId: true,
          amount: true,
          invoiceId: true,
          status: true,
          gatewayRef: true,
          idempotencyKey: true,
          sourceEventId: true,
          providerState: true,
          baselineRefundedAmount: true,
          targetCumulativeRefundedAmount: true,
          observedCumulativeRefundedAmount: true,
        },
      });
      if (refundReq.status !== RefundStatus.PROCESSING) return;

      const payment = await this.prisma.payment.findUniqueOrThrow({
        where: { id: refundReq.paymentId },
        select: {
          id: true,
          gatewayRef: true,
          amount: true,
          refundedAmount: true,
          currency: true,
        },
      });
      if (!payment.gatewayRef) {
        throw new ConflictException('Gateway refund has no payment reference');
      }
      // A RefundRequest lease is not enough: two distinct requests for the
      // same Payment can otherwise baseline the same cumulative amount and
      // both POST. This lease is the provider-call serialization fence.
      const paymentLease = await this.prisma.payment.updateMany({
        where: {
          id: payment.id,
          OR: [
            { refundProviderLeaseOwner: null },
            { refundProviderLeaseExpiresAt: null },
            { refundProviderLeaseExpiresAt: { lt: leaseNow } },
          ],
        },
        data: {
          refundProviderLeaseOwner: leaseOwner,
          refundProviderLeaseExpiresAt: leaseExpiresAt,
        },
      });
      if (paymentLease.count !== 1) {
        throw new ConflictException('Payment refund provider lease is already held');
      }
      paymentLeaseId = payment.id;

      const refundAmount = decimalToHalalas(refundReq.amount);
      const phase = refundReq.providerState === 'NOT_CALLED'
        ? 'BEFORE_CALL'
        : refundReq.providerState;
      let providerPaymentId = refundReq.gatewayRef ?? payment.gatewayRef;

      if (phase === 'BEFORE_CALL') {
        const providerPayment = await this.moyasar.getPaymentStatus(
          DEFAULT_ORG_ID,
          payment.gatewayRef,
        );
        const localAmount = decimalToHalalas(payment.amount);
        const localRefunded = decimalToHalalas(payment.refundedAmount ?? 0);
        const providerBaseline = Math.round(providerPayment.refunded);
        const providerOutstanding = providerPayment.amount - providerBaseline;
        const providerMatchesLocal =
          Number.isSafeInteger(providerBaseline)
          && providerBaseline >= 0
          && ['paid', 'captured'].includes(providerPayment.status)
          && providerPayment.id === payment.gatewayRef
          && providerPayment.amount === localAmount
          && providerPayment.currency === payment.currency
          && providerBaseline === localRefunded
          && refundAmount > 0
          && refundAmount <= providerOutstanding;
        if (!providerMatchesLocal) {
          await this.markRefundManualReview(
            cmd.refundRequestId,
            leaseOwner,
            providerBaseline,
            'Provider cumulative refund does not match local accounting; manual review required',
          );
          return;
        }

        const target = providerBaseline + refundAmount;
        await this.requireOwnedRefundUpdate(cmd.refundRequestId, leaseOwner, {
          idempotencyKey: cmd.idempotencyKey,
          ...(cmd.sourceEventId ? { sourceEventId: cmd.sourceEventId } : {}),
          providerState: 'CALL_UNKNOWN',
          baselineRefundedAmount: providerBaseline,
          targetCumulativeRefundedAmount: target,
          observedCumulativeRefundedAmount: providerBaseline,
          lastProviderError: null,
        });

        let providerRefund: Awaited<ReturnType<MoyasarApiClient['createRefund']>>;
        try {
          providerRefund = await this.moyasar.createRefund(DEFAULT_ORG_ID, {
            paymentId: payment.gatewayRef,
            amount: refundAmount,
          });
        } catch (error) {
          if (error instanceof NotFoundException) {
            await this.requireOwnedRefundUpdate(cmd.refundRequestId, leaseOwner, {
              status: RefundStatus.FAILED,
              providerState: 'FAILED',
              providerLeaseOwner: null,
              providerLeaseExpiresAt: null,
              lastProviderError: 'Provider confirmed refund resource is unavailable',
            });
          } else {
            await this.requireOwnedRefundUpdate(cmd.refundRequestId, leaseOwner, {
              providerState: 'CALL_UNKNOWN',
              lastProviderError: 'Provider refund outcome is unknown; reconciliation required',
            });
          }
          throw error;
        }

        providerPaymentId = providerRefund.id;
        if (
          providerRefund.id !== payment.gatewayRef
          || providerRefund.currency !== payment.currency
          // A cumulative amount above target is not attributable to this
          // request (another refund may have landed concurrently/out of band).
          // Only the exact baseline + requested amount is safe to account.
          || providerRefund.refunded !== target
        ) {
          await this.markRefundManualReview(
            cmd.refundRequestId,
            leaseOwner,
            providerRefund.refunded,
            'Provider response is not exactly attributable to this refund; manual review required',
          );
          return;
        }
        await this.requireOwnedRefundUpdate(cmd.refundRequestId, leaseOwner, {
          gatewayRef: providerPaymentId,
          providerState: 'CONFIRMED',
          observedCumulativeRefundedAmount: providerRefund.refunded,
          lastProviderError: null,
        });
      } else if (phase === 'CALL_UNKNOWN') {
        const baseline = refundReq.baselineRefundedAmount == null
          ? null
          : decimalToHalalas(refundReq.baselineRefundedAmount);
        const target = refundReq.targetCumulativeRefundedAmount == null
          ? null
          : decimalToHalalas(refundReq.targetCumulativeRefundedAmount);
        if (baseline == null || target == null || target <= baseline) {
          await this.markRefundManualReview(
            cmd.refundRequestId,
            leaseOwner,
            null,
            'Refund reconciliation baseline is incomplete; manual review required',
          );
          return;
        }
        const providerPayment = await this.moyasar.getPaymentStatus(
          DEFAULT_ORG_ID,
          payment.gatewayRef,
        );
        providerPaymentId = providerPayment.id;
        const providerIdentityMatches = providerPayment.id === payment.gatewayRef
          && providerPayment.amount === decimalToHalalas(payment.amount)
          && providerPayment.currency === payment.currency;
        if (!providerIdentityMatches) {
          await this.markRefundManualReview(
            cmd.refundRequestId,
            leaseOwner,
            providerPayment.refunded,
            'Provider payment identity changed during refund reconciliation; manual review required',
          );
          return;
        }
        // Cumulative provider totals cannot attribute a refund to this request
        // after a timeout: even >= target may include an external refund. Never
        // account it automatically; an operator reconciles the durable facts.
        await this.markRefundManualReview(
          cmd.refundRequestId,
          leaseOwner,
          providerPayment.refunded,
          providerPayment.refunded === baseline
            ? 'Provider cumulative refund is unchanged after an unknown call; manual review required'
            : providerPayment.refunded >= target
              ? 'Provider cumulative refund is ambiguous after an unknown call; manual review required'
              : 'Provider cumulative refund is between baseline and target; manual review required',
        );
        return;
      } else if (phase !== 'CONFIRMED') {
        throw new ConflictException(`Refund provider phase ${phase} is not retryable`);
      }

      await this.finalizeOwnedRefund({
        refundRequestId: cmd.refundRequestId,
        requestKey: cmd.idempotencyKey,
        leaseOwner,
        providerPaymentId,
        refundReq,
        refundAmount,
      });
      })();
    } catch (error) {
      primaryError = error;
      try {
        await this.prisma.refundRequest.updateMany({
          where: {
            id: cmd.refundRequestId,
            status: RefundStatus.PROCESSING,
            providerLeaseOwner: leaseOwner,
          },
          data: {
            lastProviderError: 'Refund processing failed; retry or reconciliation required',
          },
        });
      } catch (persistError) {
        primaryError = new AggregateError(
          [error, persistError],
          'Refund processing failed and retry state could not be persisted',
        );
      }
    }

    let releaseError: unknown;
    try {
      await this.prisma.refundRequest.updateMany({
        where: { id: cmd.refundRequestId, providerLeaseOwner: leaseOwner },
        data: { providerLeaseOwner: null, providerLeaseExpiresAt: null },
      });
    } catch (error) {
      releaseError = error;
    }
    if (paymentLeaseId) {
      try {
        await this.prisma.payment.updateMany({
          where: { id: paymentLeaseId, refundProviderLeaseOwner: leaseOwner },
          data: { refundProviderLeaseOwner: null, refundProviderLeaseExpiresAt: null },
        });
      } catch (error) {
        releaseError = releaseError
          ? new AggregateError([releaseError, error], 'Refund provider leases could not be released')
          : error;
      }
    }
    if (primaryError && releaseError) {
      throw new AggregateError(
        [primaryError, releaseError],
        'Refund processing failed and its provider lease could not be released',
      );
    }
    if (primaryError) throw primaryError;
    if (releaseError) throw releaseError;
  }

  private async requireOwnedRefundUpdate(
    refundRequestId: string,
    leaseOwner: string,
    data: Prisma.RefundRequestUpdateManyMutationInput,
  ): Promise<void> {
    const result = await this.prisma.refundRequest.updateMany({
      where: {
        id: refundRequestId,
        status: RefundStatus.PROCESSING,
        providerLeaseOwner: leaseOwner,
      },
      data,
    });
    if (result.count !== 1) {
      throw new ConflictException('Refund provider lease was lost');
    }
  }

  private async markRefundManualReview(
    refundRequestId: string,
    leaseOwner: string,
    observedCumulative: number | null,
    reason: string,
  ): Promise<void> {
    await this.requireOwnedRefundUpdate(refundRequestId, leaseOwner, {
      status: RefundStatus.MANUAL_REVIEW,
      providerState: 'MANUAL_REVIEW',
      ...(observedCumulative == null
        ? {}
        : { observedCumulativeRefundedAmount: observedCumulative }),
      lastProviderError: reason,
      providerLeaseOwner: null,
      providerLeaseExpiresAt: null,
    });
  }

  private async finalizeOwnedRefund(input: {
    refundRequestId: string;
    requestKey: string;
    leaseOwner: string;
    providerPaymentId: string;
    refundReq: {
      invoiceId: string;
      paymentId: string;
    };
    refundAmount: number;
  }): Promise<void> {
    await this.rlsTransaction.withTransaction(async (tx) => {
      const { count } = await tx.refundRequest.updateMany({
        where: {
          id: input.refundRequestId,
          status: RefundStatus.PROCESSING,
          providerState: 'CONFIRMED',
          providerLeaseOwner: input.leaseOwner,
        },
        data: {
          status: RefundStatus.COMPLETED,
          gatewayRef: input.providerPaymentId,
          providerState: 'CONFIRMED',
          processedAt: new Date(),
          lastProviderError: null,
          providerLeaseOwner: null,
          providerLeaseExpiresAt: null,
        },
      });
      if (count !== 1) {
        throw new ConflictException('Refund accounting lease was lost');
      }
      const currentInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id: input.refundReq.invoiceId },
        select: {
          total: true,
          vatAmt: true,
          refundedAmount: true,
          id: true,
          bookingId: true,
          currency: true,
        },
      });
      const accounting = computeRefundAccounting({
        invoiceTotal: currentInvoice.total,
        invoiceVatAmt: currentInvoice.vatAmt,
        alreadyRefundedAmount: currentInvoice.refundedAmount,
        thisRefundAmount: input.refundAmount,
      });
      const paymentStatus = accounting.newInvoiceStatus === 'REFUNDED'
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;
      await tx.payment.update({
        where: { id: input.refundReq.paymentId },
        data: {
          status: paymentStatus,
          failureReason: `Booking cancellation refund (${input.requestKey})`,
          refundedAmount: { increment: input.refundAmount },
        },
      });
      await tx.invoice.update({
        where: { id: input.refundReq.invoiceId },
        data: {
          status: accounting.newInvoiceStatus,
          refundedAmount: accounting.newRefundedAmount,
          refundedVatAmt: accounting.newRefundedVatAmt,
        },
      });

      const event = new RefundCompletedEvent({
        refundRequestId: input.refundRequestId,
        organizationId: DEFAULT_ORG_ID,
        invoiceId: input.refundReq.invoiceId,
        paymentId: input.refundReq.paymentId,
        bookingId: currentInvoice.bookingId,
        amount: input.refundAmount,
        currency: currentInvoice.currency,
      }, input.refundRequestId);
      await tx.outboxEvent.create({
        data: {
          id: event.eventId,
          aggregateId: input.refundRequestId,
          eventType: event.eventName,
          payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  async execute(cmd: RefundPaymentCommand) {
    if (cmd.sourceEventId) {
      const recovered = await this.prisma.refundRequest.findUnique({
        where: { sourceEventId: cmd.sourceEventId },
        select: {
          id: true,
          paymentId: true,
          status: true,
          idempotencyKey: true,
        },
      });
      if (recovered) {
        if (recovered.paymentId !== cmd.paymentId || !recovered.idempotencyKey) {
          throw new ConflictException('Refund source event belongs to a different request');
        }
        if (recovered.status === RefundStatus.PROCESSING) {
          await this.finalizeRefundFromCancellation({
            refundRequestId: recovered.id,
            idempotencyKey: recovered.idempotencyKey,
            sourceEventId: cmd.sourceEventId,
          });
        }
        // COMPLETED/FAILED are both durable terminal outcomes. Returning the
        // current payment acknowledges a replay after the consumer job result
        // was lost; it must not create another RefundRequest or provider call.
        return this.prisma.payment.findUniqueOrThrow({ where: { id: cmd.paymentId } });
      }
    }

    // ── Locking transaction: read + validate + persist in-flight record ──
    // SELECT FOR UPDATE prevents two concurrent requests from both reading
    // Payment.status=COMPLETED and proceeding to issue a double-refund.
    const { refundRequestId, idempotencyKey } =
      await this.rlsTransaction.withTransaction(async (tx) => {
        // Lock the payment row for the duration of this transaction.
        const rows = await tx.$queryRaw<
          Array<{
            id: string;
            status: string;
            gatewayRef: string | null;
            amount: Prisma.Decimal;
            refundedAmount: Prisma.Decimal | null;
            invoiceId: string;
          }>
        >`SELECT id, status, "gatewayRef", amount, "refundedAmount", "invoiceId"
            FROM "Payment"
            WHERE id = ${cmd.paymentId}
            FOR UPDATE`;

        const row = rows[0];
        if (!row) throw new NotFoundException('Payment not found');
        if (
          row.status !== PaymentStatus.COMPLETED &&
          row.status !== PaymentStatus.PARTIALLY_REFUNDED
        ) {
          throw new BadRequestException('Only completed or partially-refunded payments can be refunded');
        }
        // Outstanding-balance clamp below is the real over-refund guard.
        assertValidTransition(row.status as PaymentStatus, PaymentStatus.PARTIALLY_REFUNDED);
        if (!row.gatewayRef) {
          throw new BadRequestException('Payment has no gateway reference; use manual refund path');
        }

        // Fetch invoice relation (needed for org/client/booking context).
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: row.invoiceId },
          select: { id: true, bookingId: true, clientId: true, currency: true },
        });

        const lockedPayment = {
          id: row.id,
          status: row.status as PaymentStatus,
          gatewayRef: row.gatewayRef,
          // Decimal → integer halalas, converted once at the read boundary.
          amount: decimalToHalalas(row.amount),
          invoice,
        };

        const existingInFlightRefund = await tx.refundRequest.findFirst({
          where: {
            paymentId: cmd.paymentId,
            status: RefundStatus.PROCESSING,
          },
          select: { id: true },
        });
        if (existingInFlightRefund) {
          throw new BadRequestException('Payment refund is already processing');
        }

        const refAmt = cmd.amount ?? lockedPayment.amount;
        // P1 (money-safety): clamp the refund to the payment's outstanding
        // (un-refunded) balance. Without this a caller could over-refund —
        // refund more than was ever paid, or stack partial refunds past the
        // total. `refundedAmount` is read under the same FOR UPDATE lock.
        const outstanding = lockedPayment.amount - decimalToHalalas(row.refundedAmount ?? 0);
        if (refAmt <= 0 || refAmt > outstanding) {
          throw new BadRequestException(
            `Refund amount ${refAmt} exceeds the refundable balance of ${outstanding} halalas`,
          );
        }
        const reqId = randomUUID();
        // P1 (idempotency): key on the unique refundRequestId, NOT on
        // (paymentId, amount) — two equal-amount partial refunds used to
        // collide on Moyasar's side. Mirrors createRefundRequestInTx.
        const iKey = `refund:${reqId}`;

        // Step 1 — persist in-flight refund record inside the lock so no
        // concurrent request can slip past the PROCESSING check before this row exists.
        await tx.refundRequest.create({
          data: {
            id: reqId,
            invoiceId: invoice.id,
            paymentId: lockedPayment.id,
            clientId: invoice.clientId,
            amount: refAmt,
            reason: cmd.reason,
            status: RefundStatus.PROCESSING,
            processedAt: new Date(),
            processedBy: cmd.performedBy ?? 'system',
            idempotencyKey: iKey,
            sourceEventId: cmd.sourceEventId,
            providerState: 'BEFORE_CALL',
          },
          select: { id: true },
        });

        return { payment: lockedPayment, refundAmount: refAmt, refundRequestId: reqId, idempotencyKey: iKey };
      });

    // Every gateway path, including dashboard-triggered refunds, uses the same
    // exclusive lease and cumulative-refund reconciliation state machine.
    await this.finalizeRefundFromCancellation({
      refundRequestId,
      idempotencyKey,
      ...(cmd.sourceEventId ? { sourceEventId: cmd.sourceEventId } : {}),
    });
    return this.prisma.payment.findUniqueOrThrow({ where: { id: cmd.paymentId } });
  }
}
