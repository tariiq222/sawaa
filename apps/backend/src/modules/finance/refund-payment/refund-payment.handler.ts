import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
    gatewayRef: string;
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
    private readonly eventBus: EventBusService,
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
    cmd: { paymentId: string; reason: string; performedBy?: string; amount?: number },
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
    if (!row.gatewayRef) {
      throw new BadRequestException('Payment has no gateway reference; use manual refund path');
    }

    const existingInFlightRefund = await tx.refundRequest.findFirst({
      where: { paymentId: cmd.paymentId, status: RefundStatus.PROCESSING },
      select: { id: true },
    });
    if (existingInFlightRefund) {
      throw new BadRequestException('Payment refund is already processing');
    }

    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: row.invoiceId },
      select: { id: true, bookingId: true, clientId: true, currency: true },
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
    cmd: { refundRequestId: string; idempotencyKey: string },
  ): Promise<void> {
    const refundReq = await this.prisma.refundRequest.findUniqueOrThrow({
      where: { id: cmd.refundRequestId },
      select: { id: true, paymentId: true, amount: true, invoiceId: true, status: true },
    });

    if (refundReq.status === RefundStatus.COMPLETED) {
      this.logger.warn({ refundRequestId: cmd.refundRequestId }, 'refund_already_completed_skipping');
      return;
    }

    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: refundReq.paymentId },
      select: { id: true, gatewayRef: true },
    });

    // Decimal → integer halalas, converted once at the read boundary.
    const refundAmount = decimalToHalalas(refundReq.amount);

    const moyasarRefund = await this.moyasar.createRefund(DEFAULT_ORG_ID, {
      paymentId: payment.gatewayRef ?? '',
      amount: refundAmount, // already halalas
      idempotencyKey: cmd.idempotencyKey,
    });

    await this.rlsTransaction.withTransaction(async (tx) => {
      const { count } = await tx.refundRequest.updateMany({
        where: { id: cmd.refundRequestId, status: RefundStatus.PROCESSING },
        data: { status: RefundStatus.COMPLETED, gatewayRef: moyasarRefund.id },
      });
      if (count === 0) {
        this.logger.warn({ refundRequestId: cmd.refundRequestId }, 'refund_already_finalized_concurrent_skip');
        return;
      }
      const currentInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id: refundReq.invoiceId },
        select: { total: true, vatAmt: true, refundedAmount: true },
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
    });

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: refundReq.invoiceId },
      select: { id: true, bookingId: true, currency: true },
    });

    const event = new RefundCompletedEvent({
      refundRequestId: cmd.refundRequestId,
      organizationId: DEFAULT_ORG_ID,
      invoiceId: refundReq.invoiceId,
      paymentId: refundReq.paymentId,
      bookingId: invoice?.bookingId ?? '',
      amount: refundAmount,
      currency: invoice?.currency ?? '',
    });
    await this.eventBus
      .publish(event.eventName, event.toEnvelope())
      .catch((err) => this.logger.error(`Failed to publish RefundCompletedEvent`, err));
  }

  async execute(cmd: RefundPaymentCommand) {
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
          },
          select: { id: true },
        });

        return { payment: lockedPayment, refundAmount: refAmt, refundRequestId: reqId, idempotencyKey: iKey };
      });

    // Step 2 — gateway round-trip OUTSIDE any DB transaction. Never hold a
    // transaction across an external HTTP call.
    let moyasarRefundId: string | undefined;
    try {
      const moyasarRefund = await this.moyasar.createRefund(DEFAULT_ORG_ID, {
        paymentId: payment.gatewayRef,
        amount: Math.round(refundAmount), // already halalas
        idempotencyKey,
      });
      moyasarRefundId = moyasarRefund.id;
    } catch (error) {
      // Moyasar refused the refund. No money moved. Safe to mark FAILED.
      await this.prisma.refundRequest
        .update({ where: { id: refundRequestId }, data: { status: RefundStatus.FAILED } })
        .catch((persistErr) => {
          this.logger.error(
            `Refund ${refundRequestId}: failed to mark FAILED after Moyasar rejection`,
            persistErr instanceof Error ? persistErr.stack : undefined,
          );
        });
      throw error;
    }

    // Step 3 — atomic finalize. If this transaction fails, money has
    // already moved at Moyasar; we persist gatewayRef separately and
    // leave the row in PROCESSING for reconciliation.
    let updatedPayment;
    try {
      updatedPayment = await this.rlsTransaction.withTransaction(async (tx) => {
        await tx.refundRequest.update({
          where: { id: refundRequestId },
          data: { status: RefundStatus.COMPLETED, gatewayRef: moyasarRefundId },
        });
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
        return updated;
      });
    } catch (error) {
      this.logger.error(
        `Refund ${refundRequestId}: Moyasar succeeded (gatewayRef=${moyasarRefundId}) but DB finalize failed — left in PROCESSING for reconciliation`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.prisma.refundRequest
        .update({ where: { id: refundRequestId }, data: { gatewayRef: moyasarRefundId } })
        .catch((persistErr) => {
          this.logger.error(
            `Refund ${refundRequestId}: failed to persist gatewayRef after partial-success — manual intervention required`,
            persistErr instanceof Error ? persistErr.stack : undefined,
          );
        });
      throw error;
    }

    const event = new RefundCompletedEvent({
      refundRequestId,
      organizationId: DEFAULT_ORG_ID,
      invoiceId: payment.invoice.id,
      paymentId: payment.id,
      bookingId: payment.invoice.bookingId,
      amount: refundAmount,
      currency: payment.invoice.currency,
    });
    await this.eventBus
      .publish(event.eventName, event.toEnvelope())
      .catch((err) => this.logger.error(`Failed to publish RefundCompletedEvent`, err));

    return updatedPayment;
  }
}
