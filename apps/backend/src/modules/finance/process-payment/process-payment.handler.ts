import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
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

export type ProcessPaymentCommand = ProcessPaymentDto & {
  /** Join an already-open interactive transaction (e.g. collect). */
  transaction?: Prisma.TransactionClient;
};

/** Event payload collected inside the payment write and published only after commit. */
export type DeferredPaymentEvent = {
  eventName: string;
  envelope: ReturnType<PaymentCompletedEvent['toEnvelope']> | ReturnType<DepositPaidEvent['toEnvelope']>;
};

export type ProcessPaymentRecord = {
  id: string;
  invoiceId: string;
  amount: Prisma.Decimal | number;
  method: ProcessPaymentDto['method'];
  status: PaymentStatus | string;
  deferredEvents?: DeferredPaymentEvent[];
};

type PaymentRunResult = {
  payment: ProcessPaymentRecord;
  newStatus: InvoiceStatus | null;
  depositAmount: number | null;
  paidAfter: number;
  total: number;
  bookingId: string | null;
  currency: string;
};

@Injectable()
export class ProcessPaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: ProcessPaymentCommand): Promise<ProcessPaymentRecord> {
    // Capture organizationId from CLS before entering the tx callback.
    // Inside $transaction the Proxy is bypassed, so we must pass it explicitly.
    // Run the invoice check, payment insert, sum-aggregate, and invoice status
    // update inside a single transaction so a concurrent payment cannot slip
    // between the aggregate and the update and produce a wrong status or stale
    // paidAt. The @unique(idempotencyKey) constraint is the final guard against
    // duplicate payments — the pre-check is kept only as a fast short-circuit.
    const run = async (tx: Prisma.TransactionClient): Promise<PaymentRunResult> => {
      const invoice = await tx.invoice.findFirst({
        where: { id: dto.invoiceId },
      });
      if (!invoice) throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
      if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.REFUNDED) {
        throw new BadRequestException(
          `Invoice ${dto.invoiceId} cannot accept payments (status: ${invoice.status})`,
        );
      }

      const meta = {
        bookingId: invoice.bookingId,
        currency: invoice.currency,
      };

      // Replay a committed payment before outstanding/amount guards so a retry
      // after a full collection does not throw "already fully paid".
      if (dto.idempotencyKey) {
        const existingByKey = await tx.payment.findFirst({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existingByKey) {
          this.assertIdempotentReplayMatches(existingByKey, dto);
          return {
            payment: existingByKey,
            newStatus: null as InvoiceStatus | null,
            depositAmount: null as number | null,
            paidAfter: 0,
            total: Number(invoice.total),
            ...meta,
          };
        }
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

      // Let P2002 escape this transaction. PostgreSQL aborts the tx on a unique
      // violation; a find on the same client would fail with "current transaction
      // is aborted". Standalone callers recover after rollback in a fresh tx.
      // When `dto.transaction` is supplied, P2002 is propagated so the owner
      // (Collect) can recover after its own rollback — never nested, never here.
      const createdPayment = await tx.payment.create({
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
          // Stamp the official issuance time on the first payment that lifts the
          // invoice out of DRAFT. Keep an existing issuedAt untouched.
          issuedAt: invoice.issuedAt ?? new Date(),
          paidAt: status === InvoiceStatus.PAID ? new Date() : undefined,
        },
      });

      return {
        payment: createdPayment,
        newStatus: status,
        depositAmount: deposit.depositAmount,
        paidAfter: paid,
        total,
        ...meta,
      };
    };

    if (dto.transaction) {
      const outcome = await run(dto.transaction);
      return { ...outcome.payment, deferredEvents: this.toDeferredEvents(outcome, dto) };
    }

    let outcome: PaymentRunResult;
    try {
      outcome = await this.rlsTransaction.withTransaction(run);
    } catch (err) {
      if (this.isUniqueConstraintError(err) && dto.idempotencyKey) {
        return this.replayCommittedPayment(dto, err);
      }
      throw err;
    }

    const deferredEvents = this.toDeferredEvents(outcome, dto);
    await this.publishDeferredEvents(deferredEvents);
    return outcome.payment;
  }

  /**
   * After the aborted payment transaction has rolled back, read the winner in a
   * new transaction. Same-key/same-invoice replays with no events; key reuse on
   * another invoice is a conflict. Missing row rethrows the original P2002.
   */
  private async replayCommittedPayment(
    dto: ProcessPaymentCommand,
    uniqueError: unknown,
  ): Promise<ProcessPaymentRecord> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      const existing = await tx.payment.findFirst({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (!existing) throw uniqueError;
      this.assertIdempotentReplayMatches(existing, dto);
      return existing;
    });
  }

  private isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }

  async publishDeferredEvents(events: readonly DeferredPaymentEvent[] | undefined): Promise<void> {
    if (!events?.length) return;
    for (const event of events) {
      await this.eventBus.publish(event.eventName, event.envelope);
    }
  }

  /**
   * Same-key replay is allowed only when the stored Payment matches the full
   * request identity available on the row: invoiceId, amount, method, gatewayRef.
   * Used by both the fast pre-check and the post-rollback P2002 recovery.
   */
  private assertIdempotentReplayMatches(
    existing: {
      invoiceId: string;
      amount: Prisma.Decimal | number | string;
      method: string;
      gatewayRef?: string | null;
    },
    dto: ProcessPaymentCommand,
  ): void {
    if (existing.invoiceId !== dto.invoiceId) {
      throw new ConflictException('Idempotency key already used for a different invoice');
    }
    const amountMatches = decimalToHalalas(existing.amount) === decimalToHalalas(dto.amount);
    const methodMatches = existing.method === dto.method;
    // Absent/undefined request gatewayRef is equivalent to a stored null.
    const gatewayRefMatches = (existing.gatewayRef ?? null) === (dto.gatewayRef ?? null);
    if (!amountMatches || !methodMatches || !gatewayRefMatches) {
      throw new ConflictException('Idempotency key already used with a different request');
    }
  }

  private toDeferredEvents(outcome: PaymentRunResult, dto: ProcessPaymentCommand): DeferredPaymentEvent[] {
    if (outcome.newStatus === InvoiceStatus.PAID) {
      const event = new PaymentCompletedEvent({
        paymentId: outcome.payment.id,
        invoiceId: dto.invoiceId,
        bookingId: outcome.bookingId,
        amount: Number(dto.amount),
        currency: outcome.currency,
        organizationId: DEFAULT_ORG_ID,
      });
      return [{ eventName: event.eventName, envelope: event.toEnvelope() }];
    }
    if (
      outcome.newStatus === InvoiceStatus.PARTIALLY_PAID &&
      isDepositPayment({
        paidAfter: outcome.paidAfter,
        total: outcome.total,
        depositAmount: outcome.depositAmount,
      })
    ) {
      const event = new DepositPaidEvent({
        paymentId: outcome.payment.id,
        invoiceId: dto.invoiceId,
        bookingId: outcome.bookingId,
        amount: Number(dto.amount),
        currency: outcome.currency,
        organizationId: DEFAULT_ORG_ID,
      });
      return [{ eventName: event.eventName, envelope: event.toEnvelope() }];
    }
    return [];
  }
}
