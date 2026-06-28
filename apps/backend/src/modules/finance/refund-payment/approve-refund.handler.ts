import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RefundStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import { RefundCompletedEvent } from '../events/refund-completed.event';
import { computeRefundAccounting } from './refund-vat.helper';
import { decimalToHalalas } from '../money.helper';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export interface ApproveRefundCommand {
  refundRequestId: string;
  approvedBy: string;
}

export interface RefundApprovalResult {
  id: string;
  status: string;
  gatewayRef?: string;
}

@Injectable()
export class ApproveRefundHandler {
  private readonly logger = new Logger(ApproveRefundHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly moyasarClient: MoyasarApiClient,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: ApproveRefundCommand): Promise<RefundApprovalResult> {
    const refundRequest = await this.prisma.refundRequest.findFirst({
      where: {
        id: cmd.refundRequestId,
        status: 'PENDING_REVIEW',
      },
    });

    if (!refundRequest) {
      throw new NotFoundException('Refund request not found or not pending review');
    }

    // Load the Payment record to get the Moyasar gatewayRef and the figures
    // needed for the outstanding-balance clamp below.
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: refundRequest.paymentId },
      select: { gatewayRef: true, amount: true, refundedAmount: true },
    });

    if (!payment.gatewayRef) {
      throw new NotFoundException('Payment has no gateway reference — cannot refund via Moyasar');
    }

    // P1 (money-safety): clamp this approval to the payment's outstanding
    // (un-refunded) balance, mirroring RefundPaymentHandler /
    // ManualRefundPaymentHandler. Without this, a PENDING_REVIEW request whose
    // amount exceeds what is still refundable (e.g. a prior partial refund
    // already consumed part of it) could over-refund past Payment.refundedAmount.
    const refundAmount = Math.round(Number(refundRequest.amount));
    const outstanding =
      decimalToHalalas(payment.amount) - decimalToHalalas(payment.refundedAmount ?? 0);
    if (refundAmount <= 0 || refundAmount > outstanding) {
      throw new BadRequestException(
        `Refund amount ${refundAmount} exceeds the refundable balance of ${outstanding} halalas`,
      );
    }

    // P1 (money-safety): flip PENDING_REVIEW → PROCESSING atomically with a
    // conditional updateMany guarded on the current status, and bail BEFORE
    // touching the gateway if it claimed zero rows. This serialises concurrent
    // approvals: only the writer that wins the flip proceeds to Moyasar +
    // finalize, so two concurrent approves can no longer both move real money
    // and both apply the refund accounting (double-applied refund). Mirrors the
    // guarded-updateMany discipline in RefundPaymentHandler.
    const { count } = await this.prisma.refundRequest.updateMany({
      where: { id: cmd.refundRequestId, status: RefundStatus.PENDING_REVIEW },
      data: {
        status: RefundStatus.PROCESSING,
        processedBy: cmd.approvedBy,
        processedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException('Refund request is already being processed');
    }

    // Track whether Moyasar already moved real money. If so, a subsequent DB
    // failure must NOT mark the row as FAILED — the funds are gone and the
    // gatewayRef must be persisted so reconciliation can finalize the row.
    let moyasarRefundId: string | undefined;

    try {
      const moyasarRefund = await this.moyasarClient.createRefund(
        DEFAULT_ORG_ID,
        {
          paymentId: payment.gatewayRef,
          amount: refundAmount, // already halalas
          idempotencyKey: `refund:${refundRequest.id}`,
        },
      );
      moyasarRefundId = moyasarRefund.id;

      // Atomic finalize — the three writes that commit the refund (mark
      // request COMPLETED + invoice REFUNDED + payment REFUNDED) must land
      // together or not at all. Previously they were three sequential awaits;
      // a DB blip between any pair would leave books inconsistent with
      // Moyasar (real money refunded but invoice still ISSUED).
      const finalizeResult = await this.rlsTransaction.withTransaction(async (tx) => {
        // P1 (money-safety): guard the finalize on status='PROCESSING' so the
        // accounting (refundedAmount increment + status flip) is applied EXACTLY
        // once even if another writer (the reconcile-refunds cron) already
        // finalized this row. A bare update() would re-increment the ledger.
        const { count } = await tx.refundRequest.updateMany({
          where: { id: cmd.refundRequestId, status: RefundStatus.PROCESSING },
          data: {
            status: RefundStatus.COMPLETED,
            gatewayRef: moyasarRefund.id,
          },
        });
        if (count === 0) {
          this.logger.warn(
            `Refund ${cmd.refundRequestId}: already finalized by another writer — skipping accounting`,
          );
          return null;
        }
        const updated = await tx.refundRequest.findUniqueOrThrow({
          where: { id: cmd.refundRequestId },
          select: { id: true, status: true },
        });

        const invoiceForAccounting = await tx.invoice.findUniqueOrThrow({
          where: { id: refundRequest.invoiceId },
          select: { total: true, vatAmt: true, refundedAmount: true },
        });
        const accounting = computeRefundAccounting({
          invoiceTotal: invoiceForAccounting.total,
          invoiceVatAmt: invoiceForAccounting.vatAmt,
          alreadyRefundedAmount: invoiceForAccounting.refundedAmount,
          thisRefundAmount: refundAmount,
        });
        const invoice = await tx.invoice.update({
          where: { id: refundRequest.invoiceId },
          data: {
            status: accounting.newInvoiceStatus,
            refundedAmount: accounting.newRefundedAmount,
            refundedVatAmt: accounting.newRefundedVatAmt,
          },
          select: { id: true, bookingId: true, currency: true },
        });

        await tx.payment.update({
          where: { id: refundRequest.paymentId },
          data: {
            // Mirror the invoice outcome: a partial refund keeps the payment
            // refundable; only a full refund closes it.
            status: accounting.newInvoiceStatus === 'REFUNDED' ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            refundedAmount: { increment: refundAmount },
          },
        });

        return { updated, invoice };
      });

      // The finalize was a no-op because another writer (reconcile cron) had
      // already applied this refund. Money moved exactly once and the row is
      // COMPLETED — report success without re-publishing or re-counting.
      if (finalizeResult === null) {
        return {
          id: cmd.refundRequestId,
          status: RefundStatus.COMPLETED,
          gatewayRef: moyasarRefundId,
        };
      }

      const { updated, invoice } = finalizeResult;

      // Fire RefundCompletedEvent for downstream listeners. Failure to publish must
      // never break the refund itself; reconcile cron is the safety net.
      const event = new RefundCompletedEvent({
        refundRequestId: updated.id,
        organizationId: DEFAULT_ORG_ID,
        invoiceId: invoice.id,
        paymentId: refundRequest.paymentId,
        bookingId: invoice.bookingId,
        amount: refundAmount,
        currency: invoice.currency,
      });
      await this.eventBus
        .publish(event.eventName, event.toEnvelope())
        .catch(() => undefined);

      return {
        id: updated.id,
        status: updated.status,
        gatewayRef: moyasarRefund.id,
      };
    } catch (error) {
      // Two distinct failure modes — handle them differently:
      //
      // 1. Moyasar threw → no money moved. Safe to mark FAILED so the
      //    request can be re-approved later.
      // 2. Moyasar succeeded but the finalize transaction threw → money
      //    HAS been refunded by Moyasar. Marking FAILED here would
      //    desynchronize the books permanently. Persist the gatewayRef
      //    on the row so reconciliation (or a human operator) can
      //    finish the COMPLETED transition. We deliberately leave the
      //    row in PROCESSING — the presence of gatewayRef plus PROCESSING
      //    is the canonical "needs reconciliation" signal.
      if (moyasarRefundId) {
        this.logger.error(
          `Refund ${cmd.refundRequestId}: Moyasar succeeded (gatewayRef=${moyasarRefundId}) but DB finalize failed — left in PROCESSING for reconciliation`,
          error instanceof Error ? error.stack : undefined,
        );
        await this.prisma.refundRequest
          .update({
            where: { id: cmd.refundRequestId },
            data: { gatewayRef: moyasarRefundId },
          })
          .catch((persistErr) => {
            this.logger.error(
              `Refund ${cmd.refundRequestId}: failed to persist gatewayRef after partial-success — manual intervention required`,
              persistErr instanceof Error ? persistErr.stack : undefined,
            );
          });
      } else {
        await this.prisma.refundRequest.update({
          where: { id: cmd.refundRequestId },
          data: { status: 'FAILED' },
        });
      }

      throw error;
    }
  }
}
