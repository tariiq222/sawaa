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
 *   1. Persist a RefundRequest row in PROCESSING with the chosen idempotencyKey
 *      BEFORE calling Moyasar. This way, if Moyasar succeeds but our DB write
 *      fails afterwards, we have a record of the in-flight refund (with its
 *      idempotencyKey) so reconciliation can complete it without double-charging.
 *   2. Call Moyasar (real money moves).
 *   3. Atomic finalize: flip RefundRequest → COMPLETED + Payment → REFUNDED +
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
    idempotencyKey: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    return this.moyasar.createRefund(organizationId, {
      paymentId: gatewayRef,
      amount: Math.round(amount), // already halalas
      idempotencyKey,
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
        providerState: 'NOT_CALLED',
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
   * cancellation transaction. Calls Moyasar (idempotent) and then
   * atomically updates RefundRequest → COMPLETED, Payment → REFUNDED,
   * Invoice → REFUNDED inside a single RLS transaction.
   */
  async finalizeRefundFromCancellation(
    cmd: { refundRequestId: string; idempotencyKey: string; sourceEventId?: string },
  ): Promise<void> {
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
      },
    });

    if (refundReq.idempotencyKey && refundReq.idempotencyKey !== cmd.idempotencyKey) {
      throw new ConflictException('Refund idempotency key does not match the durable request');
    }
    if (refundReq.sourceEventId && cmd.sourceEventId && refundReq.sourceEventId !== cmd.sourceEventId) {
      throw new ConflictException('Refund request belongs to a different source event');
    }
    if (refundReq.status === RefundStatus.COMPLETED) {
      this.logger.warn({ refundRequestId: cmd.refundRequestId }, 'refund_already_completed_skipping');
      return;
    }
    if (refundReq.status === RefundStatus.FAILED && refundReq.providerState === 'FAILED') {
      this.logger.warn({ refundRequestId: cmd.refundRequestId }, 'refund_provider_failure_already_recorded');
      return;
    }
    if (refundReq.status !== RefundStatus.PROCESSING) {
      throw new ConflictException(`Refund request is not retryable from status ${refundReq.status}`);
    }

    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: refundReq.paymentId },
      select: { id: true, gatewayRef: true },
    });
    if (!payment.gatewayRef) {
      throw new ConflictException('Gateway refund has no payment reference');
    }

    // Decimal → integer halalas, converted once at the read boundary.
    const refundAmount = decimalToHalalas(refundReq.amount);

    // A stored provider reference proves the provider response was durably
    // recorded. Otherwise repeat the POST with the exact same provider key;
    // Moyasar's Idempotency-Key makes a response-lost retry one logical refund.
    let providerRefundId = refundReq.gatewayRef;
    let providerConfirmed = refundReq.providerState === 'CONFIRMED';
    if (providerRefundId && refundReq.providerState === 'CALL_UNKNOWN') {
      const providerStatus = await this.moyasar.getRefundStatus(
        DEFAULT_ORG_ID,
        providerRefundId,
      );
      if (providerStatus.status === 'failed') {
        await this.prisma.refundRequest.updateMany({
          where: { id: cmd.refundRequestId, status: RefundStatus.PROCESSING },
          data: {
            status: RefundStatus.FAILED,
            providerState: 'FAILED',
            lastProviderError: 'Provider confirmed refund failure',
          },
        });
        return;
      }
      if (providerStatus.status === 'pending') {
        throw new ConflictException('Provider refund is still pending reconciliation');
      }
      await this.prisma.refundRequest.updateMany({
        where: { id: cmd.refundRequestId, status: RefundStatus.PROCESSING },
        data: {
          providerState: 'CONFIRMED',
          lastProviderError: null,
        },
      });
      providerConfirmed = true;
    }
    if (!providerRefundId || !providerConfirmed) {
      await this.prisma.refundRequest.updateMany({
        where: { id: cmd.refundRequestId, status: RefundStatus.PROCESSING },
        data: {
          idempotencyKey: cmd.idempotencyKey,
          ...(cmd.sourceEventId ? { sourceEventId: cmd.sourceEventId } : {}),
          providerState: 'CALL_UNKNOWN',
          providerAttemptCount: { increment: 1 },
          lastProviderAttemptAt: new Date(),
          lastProviderError: null,
        },
      });
      try {
        const moyasarRefund = await this.moyasar.createRefund(DEFAULT_ORG_ID, {
          paymentId: payment.gatewayRef,
          amount: refundAmount,
          idempotencyKey: cmd.idempotencyKey,
        });
        providerRefundId = moyasarRefund.id;
      } catch (error) {
        if (error instanceof NotFoundException) {
          // Moyasar definitively reports that the payment/refund resource does
          // not exist. Persist the terminal provider outcome, but rethrow this
          // first delivery so the consumer never hides a provider error. A
          // replay observes FAILED and acknowledges without another call.
          await this.prisma.refundRequest.updateMany({
            where: { id: cmd.refundRequestId, status: RefundStatus.PROCESSING },
            data: {
              status: RefundStatus.FAILED,
              providerState: 'FAILED',
              lastProviderError: 'Provider confirmed refund resource is unavailable',
            },
          });
          throw error;
        }
        // Do not infer that money did not move from a timeout/5xx. Preserve the
        // ambiguous state and rethrow so BullMQ retries with the same key.
        await this.prisma.refundRequest.updateMany({
          where: { id: cmd.refundRequestId, status: RefundStatus.PROCESSING },
          data: {
            providerState: 'CALL_UNKNOWN',
            lastProviderError: 'Provider refund attempt failed; retry/reconciliation required',
          },
        });
        throw error;
      }

      // Persist provider confirmation before accounting. If this write fails,
      // replay safely repeats the idempotent provider request; if accounting
      // fails later, replay sees CONFIRMED and never calls the provider again.
      await this.prisma.refundRequest.updateMany({
        where: { id: cmd.refundRequestId, status: RefundStatus.PROCESSING },
        data: {
          gatewayRef: providerRefundId,
          providerState: 'CONFIRMED',
          lastProviderError: null,
        },
      });
    }

    if (!providerRefundId) {
      throw new ConflictException('Provider refund confirmation is missing');
    }

    await this.rlsTransaction.withTransaction(async (tx) => {
      const { count } = await tx.refundRequest.updateMany({
        where: { id: cmd.refundRequestId, status: RefundStatus.PROCESSING },
        data: {
          status: RefundStatus.COMPLETED,
          gatewayRef: providerRefundId,
          providerState: 'CONFIRMED',
          processedAt: new Date(),
          lastProviderError: null,
        },
      });
      if (count === 0) {
        this.logger.warn({ refundRequestId: cmd.refundRequestId }, 'refund_already_finalized_concurrent_skip');
        return;
      }
      const currentInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id: refundReq.invoiceId },
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
        thisRefundAmount: refundAmount,
      });
      const paymentStatus =
        accounting.newInvoiceStatus === 'REFUNDED'
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
      await tx.payment.update({
        where: { id: refundReq.paymentId },
        data: {
          status: paymentStatus,
          failureReason: `Booking cancellation refund (${cmd.idempotencyKey})`,
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

      // The completion notification is part of the same accounting commit.
      // refundRequestId is a UUID and uniquely names this logical event.
      const event = new RefundCompletedEvent({
        refundRequestId: cmd.refundRequestId,
        organizationId: DEFAULT_ORG_ID,
        invoiceId: refundReq.invoiceId,
        paymentId: refundReq.paymentId,
        bookingId: currentInvoice.bookingId,
        amount: refundAmount,
        currency: currentInvoice.currency,
      }, cmd.refundRequestId);
      await tx.outboxEvent.create({
        data: {
          id: event.eventId,
          aggregateId: cmd.refundRequestId,
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
    const { payment, refundAmount, refundRequestId, idempotencyKey } =
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
            providerState: 'NOT_CALLED',
          },
          select: { id: true },
        });

        return { payment: lockedPayment, refundAmount: refAmt, refundRequestId: reqId, idempotencyKey: iKey };
      });

    // Step 2 — gateway round-trip OUTSIDE any DB transaction. Never hold a
    // transaction across an external HTTP call.
    await this.prisma.refundRequest.update({
      where: { id: refundRequestId },
      data: {
        providerState: 'CALL_UNKNOWN',
        providerAttemptCount: { increment: 1 },
        lastProviderAttemptAt: new Date(),
        lastProviderError: null,
      },
    });
    let moyasarRefundId: string;
    try {
      const moyasarRefund = await this.moyasar.createRefund(DEFAULT_ORG_ID, {
        paymentId: payment.gatewayRef,
        amount: Math.round(refundAmount), // already halalas
        idempotencyKey,
      });
      moyasarRefundId = moyasarRefund.id;
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.prisma.refundRequest.update({
          where: { id: refundRequestId },
          data: {
            status: RefundStatus.FAILED,
            providerState: 'FAILED',
            lastProviderError: 'Provider confirmed refund resource is unavailable',
          },
        });
        throw error;
      }
      // A timeout/5xx is ambiguous: the provider may have accepted the refund.
      // Keep it retryable and let reconciliation repeat with the same key.
      await this.prisma.refundRequest.update({
        where: { id: refundRequestId },
        data: {
          providerState: 'CALL_UNKNOWN',
          lastProviderError: 'Provider refund attempt failed; retry/reconciliation required',
        },
      });
      throw error;
    }

    // Durable boundary between external success and local accounting. A crash
    // after this write is recovered without another provider mutation.
    await this.prisma.refundRequest.update({
      where: { id: refundRequestId },
      data: {
        gatewayRef: moyasarRefundId,
        providerState: 'CONFIRMED',
        lastProviderError: null,
      },
    });

    // Step 3 — atomic finalize. If this transaction fails, money has
    // already moved at Moyasar; we persist gatewayRef separately and
    // leave the row in PROCESSING for reconciliation.
    const updatedPayment = await this.rlsTransaction.withTransaction(async (tx) => {
        const { count } = await tx.refundRequest.updateMany({
          where: { id: refundRequestId, status: RefundStatus.PROCESSING },
          data: {
            status: RefundStatus.COMPLETED,
            gatewayRef: moyasarRefundId,
            providerState: 'CONFIRMED',
            lastProviderError: null,
          },
        });
        if (count === 0) {
          return tx.payment.findUniqueOrThrow({ where: { id: cmd.paymentId } });
        }
        const currentInvoice = await tx.invoice.findUniqueOrThrow({
          where: { id: payment.invoice.id },
          select: { total: true, vatAmt: true, refundedAmount: true },
        });
        const accounting = computeRefundAccounting({
          invoiceTotal: currentInvoice.total,
          invoiceVatAmt: currentInvoice.vatAmt,
          alreadyRefundedAmount: currentInvoice.refundedAmount,
          thisRefundAmount: refundAmount,
        });
        const updated = await tx.payment.update({
          where: { id: cmd.paymentId },
          data: {
            status:
              accounting.newInvoiceStatus === 'REFUNDED'
                ? PaymentStatus.REFUNDED
                : PaymentStatus.PARTIALLY_REFUNDED,
            failureReason: cmd.reason,
            refundedAmount: { increment: refundAmount },
          },
        });
        await tx.invoice.update({
          where: { id: payment.invoice.id },
          data: {
            status: accounting.newInvoiceStatus,
            refundedAmount: accounting.newRefundedAmount,
            refundedVatAmt: accounting.newRefundedVatAmt,
          },
        });

        const event = new RefundCompletedEvent({
          refundRequestId,
          organizationId: DEFAULT_ORG_ID,
          invoiceId: payment.invoice.id,
          paymentId: payment.id,
          bookingId: payment.invoice.bookingId,
          amount: refundAmount,
          currency: payment.invoice.currency,
        }, refundRequestId);
        await tx.outboxEvent.create({
          data: {
            id: event.eventId,
            aggregateId: refundRequestId,
            eventType: event.eventName,
            payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
          },
        });
        return updated;
      });

    return updatedPayment;
  }
}
