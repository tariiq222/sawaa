import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import { DepositPaidEvent } from '../events/deposit-paid.event';
import { resolveInvoiceDeposit, isDepositPayment } from '../deposit.helper';

interface VerifyPaymentCommand {
  paymentId: string;
  action: 'approve' | 'reject';
  transferRef?: string;
}

@Injectable()
export class VerifyPaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: VerifyPaymentCommand) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: cmd.paymentId },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== PaymentStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('Payment is not pending verification');
    }

    if (cmd.action === 'reject') {
      return this.prisma.payment.update({
        where: { id: cmd.paymentId },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: 'Bank transfer rejected',
        },
      });
    }

    // Approve path: mirror ProcessPaymentHandler — mark the payment COMPLETED,
    // recompute invoice.status from the sum of completed payments, and flip the
    // invoice to PAID/PARTIALLY_PAID atomically. Without this, downstream
    // consumers (reports, booking confirmation) see a stuck
    // ISSUED invoice even though the money has been received.
    const { updatedPayment, newInvoiceStatus, depositAmount, paidAfter, total } =
      await this.rlsTransaction.withTransaction(async (tx) => {
        const updated = await tx.payment.update({
          where: { id: cmd.paymentId },
          data: {
            status: PaymentStatus.COMPLETED,
            processedAt: new Date(),
            gatewayRef: cmd.transferRef ?? payment.gatewayRef,
          },
        });

        const invoice = await tx.invoice.findFirst({
          where: { id: payment.invoiceId },
        });
        if (!invoice) {
          throw new NotFoundException(`Invoice ${payment.invoiceId} not found`);
        }

        const totalPaid = await tx.payment.aggregate({
          where: { invoiceId: payment.invoiceId, status: PaymentStatus.COMPLETED },
          _sum: { amount: true },
        });

        const paid = Number(totalPaid._sum?.amount ?? 0);
        const total = Number(invoice.total);
        const status: InvoiceStatus =
          paid >= total ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

        // Resolve the configured deposit for the invoice's service so the event
        // emission below can distinguish a deposit-sized partial payment from a
        // plain partial top-up.
        const deposit = await resolveInvoiceDeposit(tx, invoice.bookingId);

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status,
            paidAt: status === InvoiceStatus.PAID ? new Date() : undefined,
          },
        });

        return {
          updatedPayment: updated,
          newInvoiceStatus: status,
          depositAmount: deposit.depositAmount,
          paidAfter: paid,
          total,
        };
      });

    if (newInvoiceStatus === InvoiceStatus.PAID) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: payment.invoiceId },
        select: { id: true, bookingId: true, currency: true },
      });
      if (invoice) {
        const event = new PaymentCompletedEvent({
          paymentId: updatedPayment.id,
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          amount: Number(updatedPayment.amount),
          currency: invoice.currency,
          organizationId: DEFAULT_ORG_ID,
        });
        await this.eventBus.publish(event.eventName, event.toEnvelope());
      }
    } else if (
      newInvoiceStatus === InvoiceStatus.PARTIALLY_PAID &&
      isDepositPayment({ paidAfter, total, depositAmount })
    ) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: payment.invoiceId },
        select: { id: true, bookingId: true, currency: true },
      });
      if (invoice) {
        const event = new DepositPaidEvent({
          paymentId: updatedPayment.id,
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          amount: Number(updatedPayment.amount),
          currency: invoice.currency,
          organizationId: DEFAULT_ORG_ID,
        });
        await this.eventBus.publish(event.eventName, event.toEnvelope());
      }
    }

    return updatedPayment;
  }
}
