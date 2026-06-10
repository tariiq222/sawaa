import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import { DepositPaidEvent } from '../events/deposit-paid.event';
import {
  resolveInvoiceDeposit,
  assertDepositPaymentAmount,
  isDepositPayment,
} from '../deposit.helper';
import { decimalToHalalas } from '../money.helper';
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
    const { payment, newStatus, depositAmount, paidAfter, total } = await this.rlsTransaction.withTransaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: dto.invoiceId },
      });
      if (!invoice) throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
      if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.REFUNDED) {
        throw new BadRequestException(
          `Invoice ${dto.invoiceId} cannot accept payments (status: ${invoice.status})`,
        );
      }

      const invoiceTotal = decimalToHalalas(invoice.total);
      // Tripwire — detect an amount sent in SAR instead of halalas.
      // Trigger ONLY on the exact signature: amount × 100 === invoice total
      // (e.g. total = 15000 halalas / 150 SAR and the caller sends 150).
      // Integer-exact on purpose: the previous ±1% float band false-positived
      // on legitimate small partial payments near total/100; exact equality
      // strictly narrows detection and avoids float division entirely.
      const amountScaledFromSar = dto.amount * 100;
      if (
        invoiceTotal > 0 &&
        Number.isSafeInteger(amountScaledFromSar) &&
        amountScaledFromSar === invoiceTotal
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

      // Deposit enforcement: when the booking's service requires a deposit, the
      // first accepted payment must be EITHER the exact deposit OR the full
      // outstanding total — never an arbitrary partial amount below the deposit.
      const deposit = await resolveInvoiceDeposit(tx, invoice.bookingId);
      if (deposit.enabled && deposit.depositAmount != null) {
        assertDepositPaymentAmount({
          amount: dto.amount,
          depositAmount: deposit.depositAmount,
          outstanding,
          alreadyPaid,
        });
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
          if (existing) {
            return {
              payment: existing,
              newStatus: null as InvoiceStatus | null,
              depositAmount: deposit.depositAmount,
              paidAfter: 0,
              total: Number(invoice.total),
            };
          }
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

      return {
        payment: createdPayment,
        newStatus: status,
        depositAmount: deposit.depositAmount,
        paidAfter: paid,
        total,
      };
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
    } else if (
      newStatus === InvoiceStatus.PARTIALLY_PAID &&
      isDepositPayment({ paidAfter, total, depositAmount })
    ) {
      // The first payment exactly matched the configured deposit and the
      // invoice is still PARTIALLY_PAID — emit DepositPaidEvent so the booking
      // moves to DEPOSIT_PAID (reserving staff time) without confirming.
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: dto.invoiceId },
        select: { id: true, bookingId: true, currency: true },
      });
      if (invoice) {
        const event = new DepositPaidEvent({
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
