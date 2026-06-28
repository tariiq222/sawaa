import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { RefundCompletedEvent } from '../events/refund-completed.event';
import { assertValidTransition } from '../payment-state-machine';
import { computeRefundAccounting } from './refund-vat.helper';
import { decimalToHalalas } from '../money.helper';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export interface ManualRefundPaymentCommand {
  paymentId: string;
  reason: string;
  amount?: number;
  performedBy?: string;
}

/**
 * Manual (cash/bank-transfer) refund for a booking payment that was collected
 * off-gateway — i.e. has NO `gatewayRef`. The gateway path
 * (`RefundPaymentHandler`) refuses these ("use manual refund path"); this is
 * that path. No money moves through Moyasar — reception hands the cash back and
 * the system records the refund and reflects it on the invoice synchronously.
 *
 * The whole thing runs in ONE transaction (no external HTTP), so the
 * RefundRequest is created COMPLETED, the Payment flips to
 * REFUNDED/PARTIALLY_REFUNDED, and the Invoice's refundedAmount/status/VAT are
 * updated atomically. SELECT ... FOR UPDATE serialises concurrent refunds and
 * the outstanding-balance clamp prevents over-refunding.
 */
@Injectable()
export class ManualRefundPaymentHandler {
  private readonly logger = new Logger(ManualRefundPaymentHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: ManualRefundPaymentCommand) {
    const { updatedPayment, refundAmount, invoice, refundRequestId } =
      await this.rlsTransaction.withTransaction(async (tx) => {
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
        assertValidTransition(row.status as PaymentStatus, PaymentStatus.PARTIALLY_REFUNDED);
        // This path is ONLY for off-gateway (cash/bank-transfer) payments.
        // Card payments carry a gatewayRef and must refund through Moyasar.
        if (row.gatewayRef) {
          throw new BadRequestException(
            'Payment was collected through the card gateway; use the gateway refund path',
          );
        }

        const existingInFlight = await tx.refundRequest.findFirst({
          where: { paymentId: cmd.paymentId, status: RefundStatus.PROCESSING },
          select: { id: true },
        });
        if (existingInFlight) {
          throw new BadRequestException('Payment refund is already processing');
        }

        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: row.invoiceId },
          select: { id: true, bookingId: true, clientId: true, currency: true, total: true, vatAmt: true, refundedAmount: true },
        });

        const fullAmount = decimalToHalalas(row.amount);
        const outstanding = fullAmount - decimalToHalalas(row.refundedAmount ?? 0);
        // Omitting the amount means "refund whatever is still refundable" — the
        // outstanding balance, NOT the original total (which would over-refund a
        // payment that was already partially refunded).
        const requestedAmount = cmd.amount === undefined ? outstanding : Math.round(cmd.amount);
        if (requestedAmount <= 0 || requestedAmount > outstanding) {
          throw new BadRequestException(
            `Refund amount ${requestedAmount} exceeds the refundable balance of ${outstanding} halalas`,
          );
        }

        const refundRequestId = randomUUID();
        const accounting = computeRefundAccounting({
          invoiceTotal: invoice.total,
          invoiceVatAmt: invoice.vatAmt,
          alreadyRefundedAmount: invoice.refundedAmount,
          thisRefundAmount: requestedAmount,
        });

        // No gateway round-trip — the refund is settled the moment reception
        // hands the cash back, so the request is born COMPLETED with no gatewayRef.
        await tx.refundRequest.create({
          data: {
            id: refundRequestId,
            invoiceId: invoice.id,
            paymentId: row.id,
            clientId: invoice.clientId,
            amount: requestedAmount,
            reason: cmd.reason,
            status: RefundStatus.COMPLETED,
            processedAt: new Date(),
            processedBy: cmd.performedBy ?? 'system',
          },
          select: { id: true },
        });

        const paymentStatus =
          accounting.newInvoiceStatus === 'REFUNDED'
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED;
        const updated = await tx.payment.update({
          where: { id: row.id },
          data: {
            status: paymentStatus,
            failureReason: cmd.reason,
            refundedAmount: { increment: requestedAmount },
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

        return { updatedPayment: updated, refundAmount: requestedAmount, invoice, refundRequestId };
      });

    const event = new RefundCompletedEvent({
      refundRequestId,
      organizationId: DEFAULT_ORG_ID,
      invoiceId: invoice.id,
      paymentId: cmd.paymentId,
      bookingId: invoice.bookingId,
      amount: refundAmount,
      currency: invoice.currency,
    });
    await this.eventBus
      .publish(event.eventName, event.toEnvelope())
      .catch((err) => this.logger.error('Failed to publish RefundCompletedEvent', err));

    return updatedPayment;
  }
}
