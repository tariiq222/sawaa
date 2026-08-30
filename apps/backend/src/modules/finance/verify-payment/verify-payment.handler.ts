import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { stableEventId } from '../../../common/events/stable-event-id';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import { DepositPaidEvent } from '../events/deposit-paid.event';
import {
  assertDepositPaymentAmount,
  isDepositPayment,
  resolveInvoiceDeposit,
} from '../deposit.helper';
import { decimalToHalalas } from '../money.helper';
import { assertBookingAcceptsPayment } from '../booking-payment-eligibility.helper';

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
  ) {}

  async execute(cmd: VerifyPaymentCommand) {
    // Resolve the invoice identity before opening the transaction. Every
    // mutation below then locks that Invoice row, which serializes approvals,
    // rejections, uploads, and completed-payment aggregation for one balance.
    const initial = await this.prisma.payment.findFirst({
      where: { id: cmd.paymentId },
    });
    if (!initial) throw new NotFoundException('Payment not found');

    return this.rlsTransaction.withTransaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${initial.invoiceId} FOR UPDATE`,
      );

      const payment = await tx.payment.findFirst({
        where: { id: cmd.paymentId },
      });
      if (!payment) throw new NotFoundException('Payment not found');

      if (cmd.action === 'reject') {
        if (
          payment.status === PaymentStatus.FAILED &&
          payment.failureReason === 'Bank transfer rejected'
        ) {
          return payment;
        }
        if (payment.status !== PaymentStatus.PENDING_VERIFICATION) {
          throw new BadRequestException('Payment is not pending verification');
        }

        const transitioned = await tx.payment.updateMany({
          where: {
            id: cmd.paymentId,
            status: PaymentStatus.PENDING_VERIFICATION,
          },
          data: {
            status: PaymentStatus.FAILED,
            failureReason: 'Bank transfer rejected',
          },
        });
        if (transitioned.count !== 1) {
          throw new BadRequestException('Payment is not pending verification');
        }
        return tx.payment.findFirstOrThrow({ where: { id: cmd.paymentId } });
      }

      // Same-action retries are idempotent. Only the transaction that performs
      // PENDING_VERIFICATION -> COMPLETED stages the durable domain event.
      if (payment.status === PaymentStatus.COMPLETED) return payment;
      if (payment.status !== PaymentStatus.PENDING_VERIFICATION) {
        throw new BadRequestException('Payment is not pending verification');
      }

      const invoice = await tx.invoice.findFirst({
        where: { id: payment.invoiceId },
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${payment.invoiceId} not found`);
      }
      if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.REFUNDED) {
        throw new BadRequestException(
          `Invoice ${invoice.id} cannot accept payments (status: ${invoice.status})`,
        );
      }

      if (invoice.bookingId) {
        const booking = await tx.booking.findFirst({
          where: { id: invoice.bookingId },
          select: { status: true },
        });
        if (!booking) throw new NotFoundException(`Booking ${invoice.bookingId} not found`);
        assertBookingAcceptsPayment(invoice.bookingId, booking.status);
      }

      const completedBefore = await tx.payment.aggregate({
        where: {
          invoiceId: payment.invoiceId,
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true },
      });
      const alreadyPaid = decimalToHalalas(completedBefore._sum?.amount ?? 0);
      const total = decimalToHalalas(invoice.total);
      const amount = decimalToHalalas(payment.amount);
      const outstanding = total - alreadyPaid;
      if (outstanding <= 0) {
        throw new BadRequestException('Invoice is already fully paid');
      }
      if (amount > outstanding) {
        throw new BadRequestException(
          `Payment amount (${amount}) exceeds outstanding balance (${outstanding})`,
        );
      }

      const deposit = await resolveInvoiceDeposit(tx, invoice.bookingId);
      if (deposit.enabled && deposit.depositAmount != null) {
        assertDepositPaymentAmount({
          amount,
          depositAmount: deposit.depositAmount,
          outstanding,
          alreadyPaid,
        });
      }

      const transitioned = await tx.payment.updateMany({
        where: {
          id: cmd.paymentId,
          status: PaymentStatus.PENDING_VERIFICATION,
        },
        data: {
          status: PaymentStatus.COMPLETED,
          processedAt: new Date(),
          gatewayRef: cmd.transferRef ?? payment.gatewayRef,
        },
      });
      if (transitioned.count !== 1) {
        throw new BadRequestException('Payment is not pending verification');
      }

      const updatedPayment = await tx.payment.findFirstOrThrow({
        where: { id: cmd.paymentId },
      });
      const paidAfter = alreadyPaid + amount;
      const newInvoiceStatus: InvoiceStatus =
        paidAfter >= total ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: newInvoiceStatus,
          issuedAt: invoice.issuedAt ?? new Date(),
          paidAt: newInvoiceStatus === InvoiceStatus.PAID ? new Date() : undefined,
        },
      });

      if (newInvoiceStatus === InvoiceStatus.PAID) {
        const event = new PaymentCompletedEvent({
          paymentId: updatedPayment.id,
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          packagePurchaseId: invoice.packagePurchaseId,
          amount,
          currency: invoice.currency,
          organizationId: DEFAULT_ORG_ID,
        });
        await this.stageEvent(tx, invoice.id, updatedPayment.id, event.eventName, event.toEnvelope());
      } else if (
        isDepositPayment({
          paidAfter,
          total,
          depositAmount: deposit.depositAmount,
        })
      ) {
        const event = new DepositPaidEvent({
          paymentId: updatedPayment.id,
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          amount,
          currency: invoice.currency,
          organizationId: DEFAULT_ORG_ID,
        });
        await this.stageEvent(tx, invoice.id, updatedPayment.id, event.eventName, event.toEnvelope());
      }

      return updatedPayment;
    });
  }

  private async stageEvent(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    paymentId: string,
    eventType: string,
    envelope: Record<string, unknown>,
  ): Promise<void> {
    const eventId = stableEventId(`finance:bank-transfer:${paymentId}:${eventType}`);
    await tx.outboxEvent.create({
      data: {
        id: eventId,
        aggregateId: invoiceId,
        eventType,
        status: 'PENDING_V2',
        deliveryLane: 'PENDING_V2',
        payload: { ...envelope, eventId } as Prisma.InputJsonValue,
      },
    });
  }
}
