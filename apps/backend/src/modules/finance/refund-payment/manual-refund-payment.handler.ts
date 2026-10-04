import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  /** Settle this reviewed off-gateway request in place, exactly once. */
  refundRequestId?: string;
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
    const { updatedPayment } =
      await this.rlsTransaction.withTransaction(async (tx) => {
        if (cmd.refundRequestId) {
          const identity = await tx.refundRequest.findUnique({ where: { id: cmd.refundRequestId }, select: { invoiceId: true, paymentId: true } });
          if (!identity || identity.paymentId !== cmd.paymentId) throw new NotFoundException('Refund request not found for this payment');
          // Match cancellation/provider follow-up lock order on the new path.
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${identity.invoiceId} FOR UPDATE`);
        }
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
        const reviewed = cmd.refundRequestId
          ? await tx.refundRequest.findUnique({ where: { id: cmd.refundRequestId } })
          : null;
        if (cmd.refundRequestId) {
          if (!reviewed || reviewed.paymentId !== row.id || reviewed.invoiceId !== row.invoiceId) throw new NotFoundException('Refund request not found for this payment');
          if (row.gatewayRef) throw new BadRequestException('Payment was collected through the card gateway; use the gateway refund path');
          if (cmd.amount !== undefined && cmd.amount !== decimalToHalalas(reviewed.amount)) throw new ConflictException('Amount must match the reviewed refund request');
          if (reviewed.status === RefundStatus.COMPLETED) return { updatedPayment: await tx.payment.findUniqueOrThrow({ where: { id: row.id } }) };
          if (reviewed.status !== RefundStatus.PENDING_REVIEW) throw new ConflictException('Refund request is not pending review');
        }
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
          select: { id: true, bookingId: true, clientId: true, currency: true, total: true, vatAmt: true, refundedAmount: true, refundedVatAmt: true },
        });

        const fullAmount = decimalToHalalas(row.amount);
        const outstanding = fullAmount - decimalToHalalas(row.refundedAmount ?? 0);
        // Omitting the amount means "refund whatever is still refundable" — the
        // outstanding balance, NOT the original total (which would over-refund a
        // payment that was already partially refunded).
        const requestedAmount = reviewed ? decimalToHalalas(reviewed.amount) : cmd.amount === undefined ? outstanding : Math.round(cmd.amount);
        if (requestedAmount <= 0 || requestedAmount > outstanding) {
          throw new BadRequestException(
            `Refund amount ${requestedAmount} exceeds the refundable balance of ${outstanding} halalas`,
          );
        }

        if (reviewed) {
          const otherReservations = await tx.refundRequest.findMany({ where: { paymentId: row.id, id: { not: reviewed.id }, status: { in: ['PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'MANUAL_REVIEW'] } }, select: { amount: true } });
          const reserved = otherReservations.reduce((sum, request) => sum + decimalToHalalas(request.amount), 0);
          if (requestedAmount > outstanding - reserved) throw new ConflictException('Other refund requests reserve this payment balance');
        }
        const refundRequestId = reviewed?.id ?? randomUUID();
        const accounting = computeRefundAccounting({
          invoiceTotal: invoice.total,
          invoiceVatAmt: invoice.vatAmt,
          alreadyRefundedAmount: invoice.refundedAmount,
          alreadyRefundedVatAmt: invoice.refundedVatAmt,
          thisRefundAmount: requestedAmount,
        });

        // No gateway round-trip — the refund is settled the moment reception
        // hands the cash back, so the request is born COMPLETED with no gatewayRef.
        if (reviewed) {
          const updated = await tx.refundRequest.updateMany({
            where: { id: reviewed.id, paymentId: row.id, status: RefundStatus.PENDING_REVIEW },
            data: { status: RefundStatus.COMPLETED, processedAt: new Date(), processedBy: cmd.performedBy ?? 'system', providerState: 'CONFIRMED', reason: cmd.reason },
          });
          if (updated.count !== 1) throw new ConflictException('Refund request changed concurrently');
        } else await tx.refundRequest.create({
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

        // Stage the completion event in the same transaction as the refund
        // state. Publishing after commit could lose the event in a process
        // crash, leaving downstream booking/receipt consumers unaware of the
        // completed refund with no durable retry path.
        const event = new RefundCompletedEvent({
          refundRequestId,
          organizationId: DEFAULT_ORG_ID,
          invoiceId: invoice.id,
          paymentId: cmd.paymentId,
          bookingId: invoice.bookingId,
          amount: requestedAmount,
          currency: invoice.currency,
        }, refundRequestId);
        await tx.outboxEvent.create({
          data: {
            id: event.eventId,
            aggregateId: refundRequestId,
            eventType: event.eventName,
            payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
          },
        });

        return { updatedPayment: updated, refundAmount: requestedAmount, invoice, refundRequestId };
      });

    return updatedPayment;
  }
}
