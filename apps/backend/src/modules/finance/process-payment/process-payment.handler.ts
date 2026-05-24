import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import { ProcessPaymentDto } from './process-payment.dto';

export type ProcessPaymentCommand = ProcessPaymentDto;

@Injectable()
export class ProcessPaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: ProcessPaymentCommand) {
    // Capture organizationId from CLS before entering the tx callback.
    // Inside $transaction the Proxy is bypassed, so we must pass it explicitly.
    // Run the invoice check, payment insert, sum-aggregate, and invoice status
    // update inside a single transaction so a concurrent payment cannot slip
    // between the aggregate and the update and produce a wrong status or stale
    // paidAt. The @unique(idempotencyKey) constraint is the final guard against
    // duplicate payments — the pre-check is kept only as a fast short-circuit.
    const { payment, newStatus } = await this.rlsTransaction.withTransaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: dto.invoiceId },
      });
      if (!invoice) throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
      if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.REFUNDED) {
        throw new BadRequestException(
          `Invoice ${dto.invoiceId} cannot accept payments (status: ${invoice.status})`,
        );
      }

      const invoiceTotal = Number(invoice.total);
      // Detect if amount was sent in SAR instead of halalas.
      // Example: invoice total = 15000 halalas (150 SAR). If caller sends amount = 150,
      // then 150 * 100 = 15000 which matches the invoice total — clear indicator of SAR unit.
      if (
        invoiceTotal > 0 &&
        Math.abs(dto.amount * 100 - invoiceTotal) / invoiceTotal < 0.01
      ) {
        throw new BadRequestException(
          'Payment amount appears to be in SAR. Send amount in integer halalas (1 SAR = 100 halalas). For SAR 150, send amount: 15000',
        );
      }

      // SECURITY (P1): clamp the client-supplied amount against the
      // outstanding invoice balance. Previously the handler accepted any
      // positive amount, letting a forged dashboard call overpay (and create
      // an unjustified refund balance) or pay above-total to credit a vendor.
      if (dto.amount <= 0) {
        throw new BadRequestException('Payment amount must be positive');
      }
      const previouslyPaid = await tx.payment.aggregate({
        where: { invoiceId: dto.invoiceId, status: 'COMPLETED' },
        _sum: { amount: true },
      });
      const alreadyPaid = Number(previouslyPaid._sum?.amount ?? 0);
      const outstanding = invoiceTotal - alreadyPaid;
      if (outstanding <= 0) {
        throw new BadRequestException('Invoice is already fully paid');
      }
      if (dto.amount > outstanding) {
        throw new BadRequestException(
          `Payment amount (${dto.amount}) exceeds outstanding balance (${outstanding})`,
        );
      }

      // SECURITY (P1): never accept a client-supplied gatewayRef for an
      // ONLINE_CARD without an out-of-band gateway re-fetch. The Moyasar
      // webhook handler is the only authoritative writer for ONLINE_CARD
      // payments. Allow operators (BANK_TRANSFER / CASH / COUPON) only.
      if (dto.method === 'ONLINE_CARD') {
        throw new BadRequestException(
          'ONLINE_CARD payments must come through the Moyasar webhook flow, not the dashboard endpoint',
        );
      }

      let createdPayment;
      try {
        createdPayment = await tx.payment.create({
          data: {
            invoiceId: dto.invoiceId,
            amount: dto.amount,
            method: dto.method,
            gatewayRef: dto.gatewayRef,
            idempotencyKey: dto.idempotencyKey,
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });
      } catch (err) {
        // P2002 = unique constraint violation — idempotencyKey already used.
        // Return the existing payment instead of failing the whole request.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          dto.idempotencyKey
        ) {
          const existing = await tx.payment.findFirst({
            where: { idempotencyKey: dto.idempotencyKey },
          });
          if (existing) return { payment: existing, newStatus: null as InvoiceStatus | null };
        }
        throw err;
      }

      const totalPaid = await tx.payment.aggregate({
        where: { invoiceId: dto.invoiceId, status: 'COMPLETED' },
        _sum: { amount: true },
      });

      const paid = Number(totalPaid._sum?.amount ?? 0);
      const total = Number(invoice.total);
      const status: InvoiceStatus =
        paid >= total ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          status,
          paidAt: status === InvoiceStatus.PAID ? new Date() : undefined,
        },
      });

      return { payment: createdPayment, newStatus: status };
    });

    // Publish the event outside the transaction so we never publish an event
    // for a payment that was rolled back.
    if (newStatus === InvoiceStatus.PAID) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: dto.invoiceId },
        select: { id: true, bookingId: true, currency: true },
      });
      if (invoice) {
        const event = new PaymentCompletedEvent({
          paymentId: payment.id,
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          amount: Number(dto.amount),
          currency: invoice.currency,
          organizationId: DEFAULT_ORG_ID,
        });
        await this.eventBus.publish(event.eventName, event.toEnvelope());
      }
    }

    return payment;
  }
}
